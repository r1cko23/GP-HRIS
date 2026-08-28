/**
 * Organic July 2026 sample-match prep (ADR 0007):
 * create cutoff periods → aggregate bundy → approve → build draft register
 * → optional GREENHRISMAIN payroll_summary compare CSV.
 *
 *   npx tsx scripts/organic-july-sample-match.ts
 *   npx tsx scripts/organic-july-sample-match.ts --skip-legacy
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { aggregateOfficeClockIntoCutoff } from "../lib/timekeeping/aggregate-office-clock";
import {
  buildRegisterLine,
  summarizeRegisterLines,
  type CutoffHoursRow,
} from "../lib/payroll-register/compute";
import type { LoanRow } from "../lib/ph-payroll/compute-cutoff-payslip";

const SKIP_LEGACY = process.argv.includes("--skip-legacy");

const ORGANIC_ORG_ID = "5edc1024-c785-4044-9a7e-758d422ccba6";
const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";
const LEGACY_CLIENT_ID = 173;

const PERIODS = [
  {
    key: "july-1-15",
    period_start: "2026-07-01",
    period_end: "2026-07-15",
    payroll_date: "2026-07-20",
    notes: "ADR 0007 golden sample — July 2026 first kinsena",
  },
  {
    key: "july-16-31",
    period_start: "2026-07-16",
    period_end: "2026-07-31",
    payroll_date: "2026-08-05",
    notes: "ADR 0007 golden sample — July 2026 second kinsena (primary)",
  },
] as const;

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

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function ensurePeriod(
  publicDb: SupabaseClient,
  period: (typeof PERIODS)[number]
) {
  const { data: existing, error: findError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("organization_id", ORGANIC_ORG_ID)
    .eq("client_id", ORGANIC_CLIENT_ID)
    .eq("period_start", period.period_start)
    .eq("period_end", period.period_end)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data, error } = await publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: ORGANIC_ORG_ID,
      client_id: ORGANIC_CLIENT_ID,
      period_start: period.period_start,
      period_end: period.period_end,
      payroll_date: period.payroll_date,
      pay_frequency: "semi-monthly",
      source_app: "gp-hris-organic",
      status: "draft",
      notes: period.notes,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function buildDraftRegister(
  publicDb: SupabaseClient,
  period: {
    id: string;
    organization_id: string;
    client_id: string;
    period_start: string;
    period_end: string;
    payroll_date: string | null;
  }
) {
  const { data: hours, error: hoursError } = await publicDb
    .from("cutoff_hours")
    .select("*")
    .eq("cutoff_period_id", period.id)
    .order("last_name");
  if (hoursError) throw new Error(hoursError.message);

  const officeIds = [
    ...new Set(
      (hours ?? [])
        .map((row) => row.office_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const payeeById = new Map<
    string,
    {
      id: string;
      monthly_rate: number | null;
      per_day: number | null;
      daily_rate: number | null;
      bank_name: string | null;
      bank_account_no: string | null;
    }
  >();
  const loansByEmployee = new Map<string, Array<LoanRow & { id: string }>>();

  if (officeIds.length) {
    const { data: payees } = await publicDb
      .from("employees")
      .select(
        "id, monthly_rate, per_day, daily_rate, bank_name, bank_account_no"
      )
      .in("id", officeIds);
    for (const row of payees ?? []) {
      payeeById.set(row.id as string, row as never);
    }

    const { data: loans } = await publicDb
      .from("employee_loans")
      .select(
        "id, employee_id, loan_type, monthly_payment, cutoff_assignment, deduct_bi_monthly, is_active"
      )
      .in("employee_id", officeIds)
      .eq("is_active", true);
    for (const loan of loans ?? []) {
      const empId = loan.employee_id as string;
      const list = loansByEmployee.get(empId) ?? [];
      list.push({
        id: loan.id as string,
        loan_type: String(loan.loan_type),
        monthly_payment: Number(loan.monthly_payment) || 0,
        cutoff_assignment: String(loan.cutoff_assignment || "both"),
        deduct_bi_monthly: loan.deduct_bi_monthly as boolean | null,
      });
      loansByEmployee.set(empId, list);
    }
  }

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const lines = (hours ?? []).map((row) => {
    const officeId = row.office_employee_id as string | null;
    return buildRegisterLine({
      hoursRow: row as CutoffHoursRow,
      payee: officeId ? payeeById.get(officeId) : null,
      loans: officeId ? loansByEmployee.get(officeId) ?? [] : [],
      periodStart,
    });
  });
  const totals = summarizeRegisterLines(lines);

  const { data: existingRun } = await publicDb
    .from("payroll_register_runs")
    .select("id, status")
    .eq("cutoff_period_id", period.id)
    .maybeSingle();

  if (existingRun?.status === "posted") {
    throw new Error(`Register already posted for ${period.period_start}`);
  }

  let runId = existingRun?.id as string | undefined;
  if (runId) {
    await publicDb.from("payroll_register_lines").delete().eq("run_id", runId);
    const { error: updError } = await publicDb
      .from("payroll_register_runs")
      .update({
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: "July 2026 sample-match draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (updError) throw new Error(updError.message);
  } else {
    const { data: created, error: createError } = await publicDb
      .from("payroll_register_runs")
      .insert({
        cutoff_period_id: period.id,
        organization_id: period.organization_id,
        client_id: period.client_id,
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: "July 2026 sample-match draft",
      })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    runId = created.id as string;
  }

  if (lines.length) {
    const { error: lineError } = await publicDb
      .from("payroll_register_lines")
      .insert(
        lines.map((line) => ({
          run_id: runId,
          cutoff_period_id: period.id,
          organization_id: period.organization_id,
          client_id: period.client_id,
          ...line,
        }))
      );
    if (lineError) throw new Error(lineError.message);
  }

  return { runId: runId!, line_count: lines.length, totals, lines };
}

type LegacyRow = {
  Employee_id: number;
  lname2: string | null;
  fname2: string | null;
  Date_Start: Date;
  Date_End: Date;
  grossalary: number | null;
  contributionSSSEE: number | null;
  contributionphilhealthEE: number | null;
  contributionPagibigEE: number | null;
  Wtax: number | null;
  Salary_Loan: number | null;
  Pagibig_Loan: number | null;
  netamount: number | null;
};

async function fetchLegacyRows(
  periodStart: string,
  periodEnd: string
): Promise<LegacyRow[]> {
  const pool = await sql.connect({
    server: required("SQL_HOST"),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 120000,
  });
  try {
    const result = await pool
      .request()
      .input("clientId", sql.Int, LEGACY_CLIENT_ID)
      .input("start", sql.Date, periodStart)
      .input("end", sql.Date, periodEnd).query(`
        SELECT
          Employee_id,
          lname2,
          fname2,
          Date_Start,
          Date_End,
          grossalary,
          contributionSSSEE,
          contributionphilhealthEE,
          contributionPagibigEE,
          Wtax,
          Salary_Loan,
          Pagibig_Loan,
          netamount
        FROM dbo.payroll_summary
        WHERE idclientp = @clientId
          AND Date_Start = @start
          AND Date_End = @end
        ORDER BY lname2, fname2
      `);
    return result.recordset as LegacyRow[];
  } finally {
    await pool.close();
  }
}

async function writeCompareCsv(
  publicDb: SupabaseClient,
  period: { id: string; period_start: string; period_end: string; key: string },
  gpLines: Array<{
    directory_employee_id: string | null;
    employee_code: string | null;
    last_name: string | null;
    first_name: string | null;
    gross_pay: number;
    deductions: Record<string, number>;
    net_pay: number;
  }>
) {
  const outDir = path.join(process.cwd(), "tmp", "sample-match");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `july-${period.period_start}_${period.period_end}.csv`
  );

  let legacy: LegacyRow[] = [];
  if (!SKIP_LEGACY) {
    try {
      legacy = await fetchLegacyRows(period.period_start, period.period_end);
      console.log(
        `  GREENHRISMAIN lines for ${period.period_start}…${period.period_end}: ${legacy.length}`
      );
    } catch (err) {
      console.warn(
        `  GREENHRISMAIN fetch failed (${err instanceof Error ? err.message : err}); writing GP-only CSV`
      );
    }
  }

  const dirIds = [
    ...new Set(
      gpLines
        .map((l) => l.directory_employee_id)
        .filter(Boolean) as string[]
    ),
  ];
  const legacyIdByDir = new Map<string, number>();
  if (dirIds.length) {
    const { data } = await publicDb
      .schema("directory")
      .from("employees")
      .select("id, legacy_id")
      .in("id", dirIds);
    for (const row of data ?? []) {
      if (row.legacy_id != null) {
        legacyIdByDir.set(row.id as string, Number(row.legacy_id));
      }
    }
  }

  const legacyByEmp = new Map<number, LegacyRow>();
  for (const row of legacy) legacyByEmp.set(Number(row.Employee_id), row);

  const header = [
    "match_key",
    "employee_code",
    "last_name",
    "first_name",
    "legacy_id",
    "gp_gross",
    "legacy_gross",
    "delta_gross",
    "gp_sss",
    "legacy_sss",
    "delta_sss",
    "gp_philhealth",
    "legacy_philhealth",
    "delta_philhealth",
    "gp_pagibig",
    "legacy_pagibig",
    "delta_pagibig",
    "gp_wtax",
    "legacy_wtax",
    "delta_wtax",
    "gp_loans",
    "legacy_loans",
    "delta_loans",
    "gp_net",
    "legacy_net",
    "delta_net",
    "status",
  ];

  const rows: string[] = [header.join(",")];
  const usedLegacy = new Set<number>();

  for (const gp of gpLines) {
    const legacyId = gp.directory_employee_id
      ? legacyIdByDir.get(gp.directory_employee_id)
      : undefined;
    const leg = legacyId != null ? legacyByEmp.get(legacyId) : undefined;
    if (legacyId != null) usedLegacy.add(legacyId);

    const legGross = leg ? Number(leg.grossalary) || 0 : null;
    const legSss = leg ? Number(leg.contributionSSSEE) || 0 : null;
    const legPhil = leg ? Number(leg.contributionphilhealthEE) || 0 : null;
    const legPag = leg ? Number(leg.contributionPagibigEE) || 0 : null;
    const legTax = leg ? Number(leg.Wtax) || 0 : null;
    const legLoans = leg
      ? round2((Number(leg.Salary_Loan) || 0) + (Number(leg.Pagibig_Loan) || 0))
      : null;
    const legNet = leg ? Number(leg.netamount) || 0 : null;

    const gpLoans = Number(gp.deductions.loans) || 0;
    const status = !leg
      ? "gp_only"
      : Math.abs(gp.net_pay - (legNet ?? 0)) < 0.02 &&
          Math.abs(gp.gross_pay - (legGross ?? 0)) < 0.02
        ? "match"
        : "mismatch";

    const delta = (a: number, b: number | null) =>
      b == null ? "" : round2(a - b);

    rows.push(
      [
        gp.employee_code ?? "",
        gp.employee_code ?? "",
        gp.last_name ?? "",
        gp.first_name ?? "",
        legacyId ?? "",
        gp.gross_pay,
        legGross ?? "",
        delta(gp.gross_pay, legGross),
        gp.deductions.sss ?? 0,
        legSss ?? "",
        delta(gp.deductions.sss ?? 0, legSss),
        gp.deductions.philhealth ?? 0,
        legPhil ?? "",
        delta(gp.deductions.philhealth ?? 0, legPhil),
        gp.deductions.pagibig ?? 0,
        legPag ?? "",
        delta(gp.deductions.pagibig ?? 0, legPag),
        gp.deductions.withholding_tax ?? 0,
        legTax ?? "",
        delta(gp.deductions.withholding_tax ?? 0, legTax),
        gpLoans,
        legLoans ?? "",
        delta(gpLoans, legLoans),
        gp.net_pay,
        legNet ?? "",
        delta(gp.net_pay, legNet),
        status,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  for (const [legacyId, leg] of legacyByEmp) {
    if (usedLegacy.has(legacyId)) continue;
    rows.push(
      [
        "",
        "",
        leg.lname2 ?? "",
        leg.fname2 ?? "",
        legacyId,
        "",
        Number(leg.grossalary) || 0,
        "",
        "",
        Number(leg.contributionSSSEE) || 0,
        "",
        "",
        Number(leg.contributionphilhealthEE) || 0,
        "",
        "",
        Number(leg.contributionPagibigEE) || 0,
        "",
        "",
        Number(leg.Wtax) || 0,
        "",
        "",
        round2(
          (Number(leg.Salary_Loan) || 0) + (Number(leg.Pagibig_Loan) || 0)
        ),
        "",
        "",
        Number(leg.netamount) || 0,
        "",
        "legacy_only",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  fs.writeFileSync(outPath, rows.join("\n"), "utf8");
  console.log(`  Wrote ${outPath} (${rows.length - 1} data rows)`);
  return outPath;
}

async function main() {
  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directoryDb = publicDb.schema("directory");

  for (const spec of PERIODS) {
    console.log(`\n=== ${spec.key} (${spec.period_start} → ${spec.period_end}) ===`);
    let period = await ensurePeriod(publicDb, spec);
    console.log(`  cutoff_period id=${period.id} status=${period.status}`);

    // Aggregation only while draft / pending_audit
    if (period.status === "approved" || period.status === "posted") {
      const { error: reopenError } = await publicDb
        .from("cutoff_periods")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", period.id);
      if (reopenError) throw new Error(reopenError.message);
      period = { ...period, status: "draft" };
      console.log("  reopened to draft for re-aggregate");
    }

    const agg = await aggregateOfficeClockIntoCutoff(
      publicDb,
      directoryDb as never,
      {
        id: period.id as string,
        organization_id: period.organization_id as string,
        client_id: period.client_id as string,
        period_start: period.period_start as string,
        period_end: period.period_end as string,
        status: "draft",
      },
      true
    );
    console.log(
      `  aggregate: hours=${agg.hours_upserted} punches=${agg.punches_upserted} skipped=${agg.employees_skipped}`
    );

    const { error: approveError } = await publicDb
      .from("cutoff_periods")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", period.id);
    if (approveError) throw new Error(approveError.message);
    console.log("  status → approved");

    const register = await buildDraftRegister(publicDb, {
      id: period.id as string,
      organization_id: period.organization_id as string,
      client_id: period.client_id as string,
      period_start: period.period_start as string,
      period_end: period.period_end as string,
      payroll_date: (period.payroll_date as string | null) ?? spec.payroll_date,
    });
    console.log(
      `  register draft run=${register.runId} lines=${register.line_count}`,
      register.totals
    );

    await writeCompareCsv(
      publicDb,
      {
        id: period.id as string,
        period_start: spec.period_start,
        period_end: spec.period_end,
        key: spec.key,
      },
      register.lines
    );
  }

  console.log("\nDone. Open /cutoff-periods (Organic org) to review hubs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
