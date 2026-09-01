/**
 * Import open Organic loans + unpaid schedules from GREENHRISMAIN.
 * Default is dry-run. Pass --apply to upsert into employee_loans.
 *
 * Env: SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DATABASE,
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   npx tsx scripts/etl-greenhrismain-loans.ts
 *   npx tsx scripts/etl-greenhrismain-loans.ts --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import {
  mapParticularToLoanType,
  normalizePaymentTerm,
} from "../lib/loans/particular";
import {
  generateLoanInstallments,
  perInstallmentFromHeader,
  type LoanPaymentTerm,
} from "../lib/loans/schedule";

type Row = Record<string, unknown>;

const APPLY = process.argv.includes("--apply");
const LEGACY_CLIENT_ID = Number(process.env.LOAN_ETL_CLIENT_ID || 173);
const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asInt(value: unknown): number {
  return Math.trunc(asNumber(value));
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asDate(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function closeAmount(a: number, b: number) {
  return Math.abs(a - b) < 1;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const wait = Math.min(1500 * 2 ** i, 15000);
      console.warn(`${label} failed (${i + 1}/${attempts}), retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function connectSql() {
  const config = {
    server: process.env.SQL_HOST || "10.0.0.222",
    port: Number(process.env.SQL_PORT || 1433),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    connectionTimeout: Number(process.env.SQL_CONNECTION_TIMEOUT_MS || 60000),
    requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT_MS || 180000),
    options: { encrypt: false, trustServerCertificate: true },
  };
  return withRetry("sql.connect", () => sql.connect(config), 6);
}

function publicAdmin(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function directoryAdmin(): SupabaseClient {
  return publicAdmin().schema("directory") as unknown as SupabaseClient;
}

async function loadDirectoryMap(
  directory: SupabaseClient,
  legacyIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!legacyIds.length) return map;
  for (let i = 0; i < legacyIds.length; i += 200) {
    const chunk = legacyIds.slice(i, i + 200);
    const { data, error } = await directory
      .from("employees")
      .select("id, legacy_id")
      .in("legacy_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.legacy_id == null || !row.id) continue;
      map.set(Number(row.legacy_id), row.id as string);
    }
    const { data: aliases, error: aliasError } = await directory
      .from("employee_code_aliases")
      .select("employee_id, legacy_id")
      .in("legacy_id", chunk);
    if (aliasError) throw aliasError;
    for (const row of aliases ?? []) {
      if (row.legacy_id == null || !row.employee_id) continue;
      if (!map.has(Number(row.legacy_id))) {
        map.set(Number(row.legacy_id), row.employee_id as string);
      }
    }
  }
  return map;
}

async function loadOfficeMap(
  publicDb: SupabaseClient,
  directoryIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!directoryIds.length) return map;
  for (let i = 0; i < directoryIds.length; i += 200) {
    const chunk = directoryIds.slice(i, i + 200);
    const { data, error } = await publicDb
      .from("employees")
      .select("id, directory_employee_id")
      .in("directory_employee_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.directory_employee_id || !row.id) continue;
      map.set(row.directory_employee_id as string, row.id as string);
    }
  }
  return map;
}

function cutoffAssignmentFromStarts(starts: string[]): "first" | "second" | "both" {
  const halves = new Set(
    starts.map((d) => (Number(d.slice(8, 10)) <= 15 ? "first" : "second"))
  );
  if (halves.size === 2) return "both";
  if (halves.has("second")) return "second";
  return "first";
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  const pool = await connectSql();
  const publicDb = publicAdmin();
  const directory = directoryAdmin();

  const loans = (
    await pool.request().input("clientId", sql.Int, LEGACY_CLIENT_ID).query(`
      SELECT
        loan.idloan,
        loan.employee_id,
        Employee.lname,
        Employee.fname,
        loan.particular,
        loan.loanamount,
        loan.paymentterm,
        loan.monthstopay,
        loan.loandatestart,
        loan.loanstatus,
        loan.approve,
        loan.partialamounttopay,
        loan.monthlysemiprincipal
      FROM loan
      INNER JOIN Employee ON loan.employee_id = Employee.Employee_id
      WHERE loan.idclientloan = @clientId
        AND ISNULL(loan.approve, 'F') = 'T'
        AND ISNULL(loan.particular, '') <> ''
        AND ISNULL(loan.loanamount, 0) > 0
    `)
  ).recordset as Row[];

  const loanIds = loans.map((row) => asInt(row.idloan)).filter((n) => n > 0);
  const schedules = loanIds.length
    ? ((
        await pool.request().query(`
          SELECT idloanschedule, idloan, datefrom, dateto, Amount, Amountpaid
          FROM loanschedule
          WHERE idloan IN (${loanIds.join(",")})
            AND ISNULL(Amount, 0) > 0
            AND ISNULL(Amountpaid, 0) = 0
        `)
      ).recordset as Row[])
    : [];
  await pool.close();

  const unpaidByLoan = new Map<number, Row[]>();
  for (const row of schedules) {
    const id = asInt(row.idloan);
    const list = unpaidByLoan.get(id) ?? [];
    list.push(row);
    unpaidByLoan.set(id, list);
  }

  const openLoans = loans.filter((row) => (unpaidByLoan.get(asInt(row.idloan)) ?? []).length > 0);
  const legacyEmployeeIds = [
    ...new Set(openLoans.map((row) => asInt(row.employee_id)).filter((n) => n > 0)),
  ];
  const directoryByLegacy = await loadDirectoryMap(directory, legacyEmployeeIds);
  const officeByDirectory = await loadOfficeMap(publicDb, [...directoryByLegacy.values()]);

  const { data: postedPeriods } = await publicDb
    .from("cutoff_periods")
    .select("id, period_start, status")
    .eq("client_id", ORGANIC_CLIENT_ID)
    .eq("status", "posted");
  const postedStarts = new Set(
    (postedPeriods ?? []).map((row) => String(row.period_start))
  );

  const { data: existingLoans } = await publicDb
    .from("employee_loans")
    .select(
      "id, employee_id, directory_employee_id, loan_type, original_balance, legacy_id, current_balance"
    );

  const byLegacy = new Map<number, Row>();
  const byEmployeeType = new Map<string, Row[]>();
  for (const row of existingLoans ?? []) {
    if (row.legacy_id != null) byLegacy.set(Number(row.legacy_id), row);
    const key = `${row.employee_id}:${row.loan_type}`;
    const list = byEmployeeType.get(key) ?? [];
    list.push(row);
    byEmployeeType.set(key, list);
  }

  const { data: existingPosts } = await publicDb
    .from("payroll_register_loan_posts")
    .select("loan_id, run_id, amount");
  const { data: runs } = await publicDb
    .from("payroll_register_runs")
    .select("id, period_start, cutoff_period_id");
  const runStart = new Map(
    (runs ?? []).map((row) => [row.id as string, String(row.period_start)])
  );
  const postedLoanPeriods = new Set(
    (existingPosts ?? []).map(
      (row) => `${row.loan_id}:${runStart.get(row.run_id as string) ?? ""}`
    )
  );

  const stats = {
    open: openLoans.length,
    matched: 0,
    created: 0,
    skippedNoPerson: 0,
    skippedNoOffice: 0,
    schedules: 0,
  };
  const skipped: string[] = [];

  for (const row of openLoans) {
    const legacyId = asInt(row.idloan);
    const legacyEmployeeId = asInt(row.employee_id);
    const name = `${asText(row.lname) ?? ""}, ${asText(row.fname) ?? ""}`.trim();
    const particular = asText(row.particular) ?? "Other";
    const loanType = mapParticularToLoanType(particular);
    const unpaid = (unpaidByLoan.get(legacyId) ?? []).sort((a, b) =>
      String(asDate(a.datefrom)).localeCompare(String(asDate(b.datefrom)))
    );
    const directoryId = directoryByLegacy.get(legacyEmployeeId);
    if (!directoryId) {
      stats.skippedNoPerson += 1;
      skipped.push(`${name} (${legacyEmployeeId}) ${particular}: no Directory person`);
      continue;
    }
    const officeId = officeByDirectory.get(directoryId);
    if (!officeId) {
      stats.skippedNoOffice += 1;
      skipped.push(`${name} ${particular}: no Bundy enrollment`);
      continue;
    }

    const paymentTerm = normalizePaymentTerm(asText(row.paymentterm));
    const perCutoff =
      round2(asNumber(row.partialamounttopay)) ||
      round2(asNumber(row.monthlysemiprincipal)) ||
      round2(asNumber(unpaid[0]?.Amount));
    const original = round2(asNumber(row.loanamount));
    const months = Math.max(1, Math.round(asNumber(row.monthstopay) || unpaid.length));
    const assignment = cutoffAssignmentFromStarts(
      unpaid.map((s) => asDate(s.datefrom) ?? "").filter(Boolean)
    );
    const monthlyPayment =
      paymentTerm === "semi-monthly" ? round2(perCutoff * 2) : perCutoff;
    const deductBiMonthly = paymentTerm === "semi-monthly";

    let gpLoan = byLegacy.get(legacyId) ?? null;
    if (!gpLoan) {
      const candidates = byEmployeeType.get(`${officeId}:${loanType}`) ?? [];
      gpLoan =
        candidates.find((c) =>
          closeAmount(asNumber(c.original_balance), original)
        ) ?? null;
    }

    const pendingRows = unpaid.filter((s) => {
      const start = asDate(s.datefrom);
      if (!start) return false;
      if (gpLoan && postedLoanPeriods.has(`${gpLoan.id}:${start}`)) return false;
      if (!gpLoan && postedStarts.has(start)) return false;
      return true;
    });
    const currentBalance = round2(
      pendingRows.reduce((acc, s) => acc + asNumber(s.Amount), 0)
    );
    const remaining = pendingRows.length;
    if (remaining <= 0 || currentBalance <= 0) continue;
    const header = {
      employee_id: officeId,
      directory_employee_id: directoryId,
      legacy_id: legacyId,
      loan_type: loanType,
      particular,
      original_balance: original,
      current_balance: currentBalance,
      monthly_payment: monthlyPayment,
      total_terms: Math.max(unpaid.length, remaining),
      remaining_terms: remaining,
      effectivity_date:
        asDate(row.loandatestart) ?? asDate(pendingRows[0]?.datefrom),
      cutoff_assignment: assignment,
      deduct_bi_monthly: deductBiMonthly,
      payment_term: paymentTerm,
      is_active: currentBalance > 0 && remaining > 0,
      notes: `Imported from GREENHRISMAIN loan ${legacyId}`,
    };

    console.log(
      `${gpLoan ? "update" : "create"} ${name} ${particular} bal=${currentBalance} due=${remaining} ${assignment}/${paymentTerm}`
    );

    if (!APPLY) {
      stats.schedules += pendingRows.length;
      if (gpLoan) stats.matched += 1;
      else stats.created += 1;
      continue;
    }

    let loanId = gpLoan?.id as string | undefined;
    if (loanId) {
      const { error } = await publicDb
        .from("employee_loans")
        .update(header)
        .eq("id", loanId);
      if (error) throw error;
      stats.matched += 1;
    } else {
      const { data, error } = await publicDb
        .from("employee_loans")
        .insert(header)
        .select("id")
        .single();
      if (error) throw error;
      loanId = data.id as string;
      stats.created += 1;
    }
    byLegacy.set(legacyId, { id: loanId, employee_id: officeId, loan_type: loanType, original_balance: original, legacy_id: legacyId });
    const usedKey = `${officeId}:${loanType}`;
    byEmployeeType.set(
      usedKey,
      (byEmployeeType.get(usedKey) ?? []).filter((row) => row.id !== loanId)
    );

    await publicDb
      .from("employee_loan_schedules")
      .delete()
      .eq("loan_id", loanId)
      .eq("status", "pending");

    if (pendingRows.length) {
      const { error: schedError } = await publicDb
        .from("employee_loan_schedules")
        .insert(
          pendingRows.map((s) => ({
            loan_id: loanId,
            period_start: asDate(s.datefrom),
            period_end: asDate(s.dateto),
            amount: round2(asNumber(s.Amount)),
            amount_paid: 0,
            status: "pending",
            legacy_id: asInt(s.idloanschedule),
          }))
        );
      if (schedError) throw schedError;
      stats.schedules += pendingRows.length;
    }
  }

  const { data: leftover } = await publicDb
    .from("employee_loans")
    .select(
      "id, employee_id, loan_type, original_balance, current_balance, monthly_payment, total_terms, remaining_terms, effectivity_date, cutoff_assignment, deduct_bi_monthly, payment_term, is_active"
    )
    .is("legacy_id", null)
    .eq("is_active", true)
    .gt("current_balance", 0);

  for (const loan of leftover ?? []) {
    const { count } = await publicDb
      .from("employee_loan_schedules")
      .select("id", { count: "exact", head: true })
      .eq("loan_id", loan.id);
    if ((count ?? 0) > 0) continue;
    const paymentTerm = (asText(loan.payment_term) as LoanPaymentTerm) ||
      (loan.deduct_bi_monthly === false ? "monthly" : "semi-monthly");
    const perInstallment = perInstallmentFromHeader({
      monthlyPayment: Number(loan.monthly_payment) || 0,
      paymentTerm,
      deductBiMonthly: loan.deduct_bi_monthly as boolean | null,
    });
    const fromBalance =
      perInstallment > 0
        ? Math.max(1, Math.round(Number(loan.current_balance) / perInstallment))
        : 1;
    const installments = generateLoanInstallments({
      effectivityDate: String(loan.effectivity_date),
      installmentCount: fromBalance,
      perInstallment,
      originalBalance: Number(loan.current_balance) || 0,
      paymentTerm,
      cutoffAssignment: (loan.cutoff_assignment as "first" | "second" | "both") || "both",
    });
    const future = installments.filter((row) => !postedStarts.has(row.period_start));
    console.log(
      `generate ${loan.loan_type} ${loan.id} ${future.length} remaining installments (GP-only)`
    );
    if (!APPLY || !future.length) continue;
    const { error } = await publicDb.from("employee_loan_schedules").insert(
      future.map((row) => ({
        loan_id: loan.id,
        period_start: row.period_start,
        period_end: row.period_end,
        amount: row.amount,
        status: "pending",
      }))
    );
    if (error) throw error;
    await publicDb
      .from("employee_loans")
      .update({
        remaining_terms: future.length,
        total_terms: Math.max(Number(loan.total_terms) || 0, future.length),
        current_balance: round2(future.reduce((acc, r) => acc + r.amount, 0)),
        payment_term: paymentTerm,
      })
      .eq("id", loan.id);
    stats.schedules += future.length;
  }

  console.log("\n=== summary ===");
  console.table(stats);
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const line of skipped) console.log(" -", line);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
