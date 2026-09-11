/**
 * Catalog-mirror 2026 MAIN payroll_summary (+ hours) into GP posted cutoffs/registers.
 * Does NOT run GP loan Post (keeps open-loan balances). Dry-run default; pass --apply.
 *
 *   npx tsx scripts/etl-greenhrismain-posted-payroll.ts --year 2026 --legacy-client 130
 *   npx tsx scripts/etl-greenhrismain-posted-payroll.ts --year 2026 --legacy-client 130 --apply
 *   npx tsx scripts/etl-greenhrismain-posted-payroll.ts --year 2026 --all --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { mainHoursToCutoffRow } from "../lib/payroll-register/main-hours-to-cutoff-row";
import {
  MAIN_CATALOG_NOTES_PREFIX,
  MAIN_CATALOG_SOURCE_APP,
  mainCatalogRunTotals,
  mainSummaryRowsToRegisterLine,
} from "../lib/payroll-register/main-summary-to-register-line";
import { planMainPayrollMirror } from "../lib/payroll-register/plan-main-payroll-mirror";

type Row = Record<string, unknown>;

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return undefined;
}

const YEAR = Number(argValue("--year") || "2026");
const LEGACY_CLIENT_ID = Number(argValue("--legacy-client") || "130");

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
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function asInt(value: unknown): number {
  return Math.trunc(asNumber(value));
}

function asDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchPaged<T>(
  label: string,
  run: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await run(from, from + page - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < page) {
      console.log(`${label} ${out.length}`);
      return out;
    }
  }
}

async function connectSql() {
  return withRetry("sql.connect", () =>
    sql.connect({
      server: process.env.SQL_HOST || "10.0.0.222",
      port: Number(process.env.SQL_PORT || 1433),
      user: required("SQL_USER"),
      password: required("SQL_PASSWORD"),
      database: process.env.SQL_DATABASE || "GREENHRISMAIN",
      connectionTimeout: 60000,
      requestTimeout: 300000,
      options: { encrypt: false, trustServerCertificate: true },
    })
  );
}

function publicAdmin(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type PeriodKey = string;

function periodKey(
  legacyClientId: number,
  legacyBranchId: number,
  start: string,
  end: string
): PeriodKey {
  return `${legacyClientId}:${legacyBranchId}:${start}:${end}`;
}

type PeriodBucket = {
  legacyClientId: number;
  legacyBranchId: number;
  mainBranchName: string;
  periodStart: string;
  periodEnd: string;
  payrollDate: string | null;
  rows: Row[];
};

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  console.log(
    ALL
      ? `MAIN catalog mirror · year ${YEAR} · all clients`
      : `MAIN catalog mirror · year ${YEAR} · idclientp=${LEGACY_CLIENT_ID}`
  );

  const pool = await connectSql();
  const request = pool.request().input("year", sql.Int, YEAR);
  if (!ALL) request.input("clientId", sql.Int, LEGACY_CLIENT_ID);

  const summarySql = `
    SELECT
      ps.idpayrollsum,
      ps.Employee_id,
      ps.idclientp,
      ps.idclientbranchp,
      ps.idbranchpositionp,
      ps.idtimekeep,
      ps.Date_Start,
      ps.Date_End,
      ps.payrolldate,
      ps.lname2,
      ps.fname2,
      ps.basic,
      ps.grossalary,
      ps.Totalsalary,
      ps.TotalOT,
      ps.Totaldeduction,
      ps.netamount,
      ps.contributionSSSEE,
      ps.contributionphilhealthEE,
      ps.contributionPagibigEE,
      ps.Wtax,
      ps.Salary_Loan,
      ps.Pagibig_Loan,
      ps.Other_Deduction,
      ps.dailyrate_payroll,
      ps.noofhourswork,
      ps.noofdayswork,
      ps.LegalHoliday_Hours,
      ps.Holiday_Special_Hours,
      ps.LegalHoliday,
      ps.Holiday_Special,
      ps.Adjustment,
      ps.thirteenmonth,
      ps.ytdthirteenmonth,
      ps.silp,
      ps.payrollatmno,
      ps.empbankname,
      ps.posted,
      ps.payrollstatus,
      ps.datalocked,
      cb.branch AS main_branch_name
    FROM payroll_summary ps
    LEFT JOIN client_branch cb ON cb.idclientbranch = ps.idclientbranchp
    WHERE YEAR(ps.Date_Start) = @year
      AND ISNULL(ps.posted, '') IN ('Yes', 'Y', 'yes', '1', 'T')
      ${ALL ? "" : "AND ps.idclientp = @clientId"}
  `;

  console.log("Loading payroll_summary…");
  const summaryResult = await request.query(summarySql);
  const summaryRows = summaryResult.recordset as Row[];
  console.log(`MAIN summary rows ${summaryRows.length}`);

  const timekeepIds = [
    ...new Set(
      summaryRows
        .map((row) => asInt(row.idtimekeep))
        .filter((id) => id > 0)
    ),
  ];
  const timekeepById = new Map<number, Row>();
  for (let i = 0; i < timekeepIds.length; i += 400) {
    const chunk = timekeepIds.slice(i, i + 400);
    if (!chunk.length) continue;
    const tk = await pool.request().query(`
      SELECT
        idtimekeep, employeeid, idclientbranch, idposition,
        actualregularhours, noofhourswork, Overtime_Hours, Nightdiff_Hours,
        regularnightshiftOT_hours,
        LegalHoliday_Hours, LegalHolidayOT_Hours, LegalHolidayND_Hours, lhotndh,
        Holiday_Special_Hours, Holiday_SpecialOT_Hours, Holiday_SpecialND_Hours, shotndh,
        rdhours, RDothours, rdndhours, rdotndh,
        lhwdohours, lhwdoothours, shwdohours, shwdoothours, WDOhours,
        tardiness, undertime, absences, pto, allowance, dailyrate_payroll
      FROM tbl_timekeep
      WHERE idtimekeep IN (${chunk.join(",")})
    `);
    for (const row of tk.recordset as Row[]) {
      timekeepById.set(asInt(row.idtimekeep), row);
    }
  }
  console.log(`tbl_timekeep loaded ${timekeepById.size}`);
  await pool.close();

  const buckets = new Map<PeriodKey, PeriodBucket>();
  for (const row of summaryRows) {
    const legacyClientId = asInt(row.idclientp);
    const legacyBranchId = asInt(row.idclientbranchp);
    const periodStart = asDate(row.Date_Start);
    const periodEnd = asDate(row.Date_End);
    if (!legacyClientId || !periodStart || !periodEnd) continue;
    const key = periodKey(legacyClientId, legacyBranchId, periodStart, periodEnd);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        legacyClientId,
        legacyBranchId,
        mainBranchName: String(row.main_branch_name ?? "").trim(),
        periodStart,
        periodEnd,
        payrollDate: asDate(row.payrolldate) || null,
        rows: [],
      };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
    if (!bucket.payrollDate && asDate(row.payrolldate)) {
      bucket.payrollDate = asDate(row.payrolldate);
    }
    if (!bucket.mainBranchName && row.main_branch_name) {
      bucket.mainBranchName = String(row.main_branch_name).trim();
    }
  }
  console.log(`MAIN periods ${buckets.size}`);

  const publicDb = publicAdmin();
  const directory = publicDb.schema("directory") as unknown as SupabaseClient;

  const employees = await fetchPaged<{
    id: string;
    legacy_id: number | null;
    employee_code: string | null;
    client_id: string | null;
    branch_id: string | null;
    organization_id: string | null;
  }>("directory.employees", (from, to) =>
    directory
      .from("employees")
      .select("id, legacy_id, employee_code, client_id, branch_id, organization_id")
      .not("legacy_id", "is", null)
      .order("id")
      .range(from, to)
  );
  const byLegacyEmp = new Map<number, (typeof employees)[number]>();
  for (const row of employees) {
    if (row.legacy_id == null) continue;
    byLegacyEmp.set(Number(row.legacy_id), row);
  }
  const aliases = await fetchPaged<{ employee_id: string; legacy_id: number }>(
    "employee_code_aliases",
    (from, to) =>
      directory
        .from("employee_code_aliases")
        .select("employee_id, legacy_id")
        .not("legacy_id", "is", null)
        .order("legacy_id")
        .range(from, to)
  );
  for (const row of aliases) {
    if (byLegacyEmp.has(Number(row.legacy_id))) continue;
    const emp = employees.find((e) => e.id === row.employee_id);
    if (emp) byLegacyEmp.set(Number(row.legacy_id), emp);
  }

  const clients = await fetchPaged<{
    id: string;
    legacy_id: number | null;
    organization_id: string;
    name: string;
  }>("directory.clients", (from, to) =>
    directory
      .from("clients")
      .select("id, legacy_id, organization_id, name")
      .order("id")
      .range(from, to)
  );
  const clientByLegacy = new Map<number, (typeof clients)[number]>();
  for (const row of clients) {
    if (row.legacy_id == null) continue;
    clientByLegacy.set(Number(row.legacy_id), row);
  }

  const branches = await fetchPaged<{
    id: string;
    client_id: string;
    name: string;
    legacy_id: number | null;
  }>("directory.client_branches", (from, to) =>
    directory
      .from("client_branches")
      .select("id, client_id, name, legacy_id")
      .order("id")
      .range(from, to)
  );
  const branchByLegacy = new Map<number, string>();
  const branchesByClient = new Map<string, typeof branches>();
  for (const row of branches) {
    if (row.legacy_id != null) branchByLegacy.set(Number(row.legacy_id), row.id);
    const list = branchesByClient.get(row.client_id) ?? [];
    list.push(row);
    branchesByClient.set(row.client_id, list);
  }

  function resolveBranchId(
    clientId: string,
    legacyBranchId: number,
    mainBranchName: string
  ): string | null {
    if (legacyBranchId > 0 && branchByLegacy.has(legacyBranchId)) {
      return branchByLegacy.get(legacyBranchId)!;
    }
    const list = branchesByClient.get(clientId) ?? [];
    const folded = fold(mainBranchName);
    if (folded) {
      const hit = list.find((b) => fold(b.name) === folded);
      if (hit) return hit.id;
      const soft = list.find(
        (b) => fold(b.name).includes(folded) || folded.includes(fold(b.name))
      );
      if (soft) return soft.id;
    }
    return null;
  }

  const officeMap = new Map<string, string>();
  const officeRows = await fetchPaged<{
    id: string;
    directory_employee_id: string | null;
  }>("public.employees", (from, to) =>
    publicDb
      .from("employees")
      .select("id, directory_employee_id")
      .not("directory_employee_id", "is", null)
      .order("id")
      .range(from, to)
  );
  for (const row of officeRows) {
    if (row.directory_employee_id) {
      officeMap.set(row.directory_employee_id, row.id);
    }
  }

  const existingCutoffs = await fetchPaged<{
    id: string;
    client_id: string;
    branch_id: string | null;
    organization_id: string;
    period_start: string;
    period_end: string;
    status: string;
    source_app: string | null;
  }>("cutoff_periods", (from, to) =>
    publicDb
      .from("cutoff_periods")
      .select(
        "id, client_id, branch_id, organization_id, period_start, period_end, status, source_app"
      )
      .gte("period_start", `${YEAR}-01-01`)
      .order("id")
      .range(from, to)
  );
  const cutoffsByClientDates = new Map<string, typeof existingCutoffs>();
  for (const row of existingCutoffs) {
    const key = `${row.client_id}:${String(row.period_start).slice(0, 10)}:${String(row.period_end).slice(0, 10)}`;
    const list = cutoffsByClientDates.get(key) ?? [];
    list.push(row);
    cutoffsByClientDates.set(key, list);
  }

  const existingRuns = await fetchPaged<{
    id: string;
    cutoff_period_id: string;
    status: string;
    notes: string | null;
  }>("payroll_register_runs", (from, to) =>
    publicDb
      .from("payroll_register_runs")
      .select("id, cutoff_period_id, status, notes")
      .order("id")
      .range(from, to)
  );
  const runByCutoff = new Map<string, (typeof existingRuns)[number]>();
  for (const row of existingRuns) {
    runByCutoff.set(row.cutoff_period_id, row);
  }

  const loanPostsBefore = await publicDb
    .from("payroll_register_loan_posts")
    .select("id", { count: "exact", head: true });
  const loanPostsCountBefore = loanPostsBefore.count ?? 0;

  const stats = {
    periods: buckets.size,
    create: 0,
    upsert_hours: 0,
    replace_catalog_run: 0,
    skip_organic_posted: 0,
    skip_no_directory: 0,
    people_matched: 0,
    people_skipped: 0,
    hours_rows: 0,
    register_lines: 0,
  };

  const sortedBuckets = [...buckets.values()].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart) ||
    a.legacyClientId - b.legacyClientId
  );

  for (const bucket of sortedBuckets) {
    const client = clientByLegacy.get(bucket.legacyClientId) ?? null;
    const directoryClientId = client?.id ?? null;
    const organizationId = client?.organization_id ?? null;
    const preferredBranch = directoryClientId
      ? resolveBranchId(
          directoryClientId,
          bucket.legacyBranchId,
          bucket.mainBranchName
        )
      : null;

    const dateKey = directoryClientId
      ? `${directoryClientId}:${bucket.periodStart}:${bucket.periodEnd}`
      : "";
    const candidates = dateKey ? cutoffsByClientDates.get(dateKey) ?? [] : [];
    const existingCutoff =
      candidates.find((c) => c.branch_id === preferredBranch) ??
      candidates.find((c) => c.source_app === MAIN_CATALOG_SOURCE_APP) ??
      candidates[0] ??
      null;
    const existingRun = existingCutoff
      ? runByCutoff.get(existingCutoff.id) ?? null
      : null;

    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: bucket.legacyClientId,
        legacyBranchId: bucket.legacyBranchId || null,
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
      },
      directoryClientId,
      directoryBranchId: preferredBranch,
      existingCutoff: existingCutoff
        ? {
            id: existingCutoff.id,
            status: existingCutoff.status,
            source_app: existingCutoff.source_app,
          }
        : null,
      existingRun: existingRun
        ? {
            id: existingRun.id,
            status: existingRun.status,
            notes: existingRun.notes,
          }
        : null,
    });

    stats[plan.action] += 1;
    if (
      plan.action === "skip_organic_posted" ||
      plan.action === "skip_no_directory"
    ) {
      continue;
    }
    if (!directoryClientId || !organizationId) continue;

    const branchId = existingCutoff?.branch_id ?? preferredBranch;
    const notes = `${MAIN_CATALOG_NOTES_PREFIX} ${YEAR} — amounts from payroll_summary; loans not posted via GP`;

    // Collapse MAIN rows by Directory person
    const byPerson = new Map<string, Row[]>();
    let skippedPeople = 0;
    for (const row of bucket.rows) {
      const legacyEmp = asInt(row.Employee_id);
      const emp = byLegacyEmp.get(legacyEmp);
      if (!emp) {
        skippedPeople += 1;
        continue;
      }
      const list = byPerson.get(emp.id) ?? [];
      list.push(row);
      byPerson.set(emp.id, list);
    }
    stats.people_skipped += skippedPeople;
    stats.people_matched += byPerson.size;

    const hourRows = [...byPerson.entries()].map(([directoryEmployeeId, rows]) => {
      const emp = byLegacyEmp.get(asInt(rows[0]!.Employee_id))!;
      const tkId = asInt(rows[0]!.idtimekeep);
      const tk = tkId > 0 ? timekeepById.get(tkId) : null;
      const source = { ...(tk ?? {}), ...rows[0]! };
      // Prefer summed summary hours when multiple rows; merge timekeep onto first
      if (rows.length > 1) {
        source.noofhourswork = rows.reduce(
          (acc, r) => acc + asNumber(r.noofhourswork),
          0
        );
        source.LegalHoliday_Hours = rows.reduce(
          (acc, r) => acc + asNumber(r.LegalHoliday_Hours),
          0
        );
        source.Holiday_Special_Hours = rows.reduce(
          (acc, r) => acc + asNumber(r.Holiday_Special_Hours),
          0
        );
      }
      return mainHoursToCutoffRow({
        directoryEmployeeId,
        officeEmployeeId: officeMap.get(directoryEmployeeId) ?? null,
        branchId,
        positionId: null,
        employeeCode: emp.employee_code,
        lastName: String(rows[0]!.lname2 ?? "").trim(),
        firstName: String(rows[0]!.fname2 ?? "").trim(),
        source,
      });
    });

    const registerLines = [...byPerson.entries()].map(
      ([directoryEmployeeId, rows]) => {
        const emp = byLegacyEmp.get(asInt(rows[0]!.Employee_id))!;
        const enriched = rows.map((row) => {
          const tkId = asInt(row.idtimekeep);
          const tk = tkId > 0 ? timekeepById.get(tkId) : null;
          return {
            ...row,
            last_name: row.lname2,
            first_name: row.fname2,
            ...(tk ?? {}),
            // Keep summary money authoritative when both present
            basic: row.basic,
            grossalary: row.grossalary,
            netamount: row.netamount,
            Totaldeduction: row.Totaldeduction,
            noofhourswork: row.noofhourswork ?? tk?.noofhourswork,
          };
        });
        return mainSummaryRowsToRegisterLine({
          directoryEmployeeId,
          officeEmployeeId: officeMap.get(directoryEmployeeId) ?? null,
          employeeCode: emp.employee_code,
          rows: enriched,
        });
      }
    );

    const totals = mainCatalogRunTotals(registerLines);

    console.log(
      `${plan.action} client=${bucket.legacyClientId} branch=${bucket.mainBranchName || bucket.legacyBranchId} ${bucket.periodStart}…${bucket.periodEnd} people=${byPerson.size} skip=${skippedPeople}`
    );

    if (!APPLY) {
      stats.hours_rows += hourRows.length;
      stats.register_lines += registerLines.length;
      continue;
    }

    let cutoffId = existingCutoff?.id ?? null;
    if (!cutoffId) {
      const { data, error } = await publicDb
        .from("cutoff_periods")
        .insert({
          organization_id: organizationId,
          client_id: directoryClientId,
          branch_id: branchId,
          period_start: bucket.periodStart,
          period_end: bucket.periodEnd,
          payroll_date: bucket.payrollDate,
          pay_frequency: "semi-monthly",
          source_app: MAIN_CATALOG_SOURCE_APP,
          status: "posted",
          notes,
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      cutoffId = data.id as string;
      const list = cutoffsByClientDates.get(dateKey) ?? [];
      list.push({
        id: cutoffId,
        client_id: directoryClientId,
        branch_id: branchId,
        organization_id: organizationId,
        period_start: bucket.periodStart,
        period_end: bucket.periodEnd,
        status: "posted",
        source_app: MAIN_CATALOG_SOURCE_APP,
      });
      cutoffsByClientDates.set(dateKey, list);
    } else {
      const { error } = await publicDb
        .from("cutoff_periods")
        .update({
          status: "posted",
          source_app: MAIN_CATALOG_SOURCE_APP,
          notes,
          payroll_date: bucket.payrollDate,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cutoffId);
      if (error) throw error;
    }

    const { error: delHoursError } = await publicDb
      .from("cutoff_hours")
      .delete()
      .eq("cutoff_period_id", cutoffId);
    if (delHoursError) throw delHoursError;

    for (let i = 0; i < hourRows.length; i += 200) {
      const chunk = hourRows.slice(i, i + 200).map((row) => ({
        cutoff_period_id: cutoffId,
        organization_id: organizationId,
        client_id: directoryClientId,
        directory_employee_id: row.directory_employee_id,
        office_employee_id: row.office_employee_id,
        branch_id: row.branch_id,
        position_id: row.position_id,
        employee_code: row.employee_code,
        last_name: row.last_name,
        first_name: row.first_name,
        actual_regular_hours: row.actual_regular_hours ?? 0,
        hours_work: row.hours_work ?? 0,
        overtime_hours: row.overtime_hours ?? 0,
        night_diff_hours: row.night_diff_hours ?? 0,
        regular_night_ot_hours: row.regular_night_ot_hours ?? 0,
        legal_holiday_hours: row.legal_holiday_hours ?? 0,
        legal_holiday_ot_hours: row.legal_holiday_ot_hours ?? 0,
        legal_holiday_nd_hours: row.legal_holiday_nd_hours ?? 0,
        legal_holiday_ot_nd_hours: row.legal_holiday_ot_nd_hours ?? 0,
        special_holiday_hours: row.special_holiday_hours ?? 0,
        special_holiday_ot_hours: row.special_holiday_ot_hours ?? 0,
        special_holiday_nd_hours: row.special_holiday_nd_hours ?? 0,
        special_holiday_ot_nd_hours: row.special_holiday_ot_nd_hours ?? 0,
        rest_day_hours: row.rest_day_hours ?? 0,
        rest_day_ot_hours: row.rest_day_ot_hours ?? 0,
        rest_day_nd_hours: row.rest_day_nd_hours ?? 0,
        rest_day_ot_nd_hours: row.rest_day_ot_nd_hours ?? 0,
        lh_rest_day_hours: row.lh_rest_day_hours ?? 0,
        lh_rest_day_ot_hours: row.lh_rest_day_ot_hours ?? 0,
        sh_rest_day_hours: row.sh_rest_day_hours ?? 0,
        sh_rest_day_ot_hours: row.sh_rest_day_ot_hours ?? 0,
        wdo_hours: row.wdo_hours ?? 0,
        tardiness_hours: row.tardiness_hours ?? 0,
        undertime_hours: row.undertime_hours ?? 0,
        absences_hours: row.absences_hours ?? 0,
        pto_hours: row.pto_hours ?? 0,
        allowance: row.allowance,
        daily_rate_payroll: row.daily_rate_payroll,
        source_of_data: row.source_of_data,
        legacy_idtimekeep: row.legacy_idtimekeep,
        tk_status: "catalog",
      }));
      const { error } = await publicDb.from("cutoff_hours").insert(chunk);
      if (error) throw error;
    }
    stats.hours_rows += hourRows.length;

    let runId = existingRun?.id ?? null;
    if (runId) {
      const { error } = await publicDb
        .from("payroll_register_runs")
        .update({
          status: "posted",
          period_start: bucket.periodStart,
          period_end: bucket.periodEnd,
          payroll_date: bucket.payrollDate,
          line_count: registerLines.length,
          totals,
          notes,
          posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);
      if (error) throw error;
      const { error: delLinesError } = await publicDb
        .from("payroll_register_lines")
        .delete()
        .eq("run_id", runId);
      if (delLinesError) throw delLinesError;
    } else {
      const { data, error } = await publicDb
        .from("payroll_register_runs")
        .insert({
          cutoff_period_id: cutoffId,
          organization_id: organizationId,
          client_id: directoryClientId,
          status: "posted",
          period_start: bucket.periodStart,
          period_end: bucket.periodEnd,
          payroll_date: bucket.payrollDate,
          line_count: registerLines.length,
          totals,
          notes,
          posted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      runId = data.id as string;
      runByCutoff.set(cutoffId, {
        id: runId,
        cutoff_period_id: cutoffId,
        status: "posted",
        notes,
      });
    }

    for (let i = 0; i < registerLines.length; i += 100) {
      const chunk = registerLines.slice(i, i + 100).map((line) => ({
        run_id: runId,
        cutoff_period_id: cutoffId,
        organization_id: organizationId,
        client_id: directoryClientId,
        directory_employee_id: line.directory_employee_id,
        office_employee_id: line.office_employee_id,
        employee_code: line.employee_code,
        last_name: line.last_name,
        first_name: line.first_name,
        daily_rate: line.daily_rate,
        monthly_salary: line.monthly_salary,
        hours: line.hours,
        earnings: line.earnings,
        deductions: line.deductions,
        loan_lines: line.loan_lines,
        gross_pay: line.gross_pay,
        total_deductions: line.total_deductions,
        net_pay: line.net_pay,
        bank_name: line.bank_name,
        bank_account_no: line.bank_account_no,
      }));
      const { error } = await publicDb.from("payroll_register_lines").insert(chunk);
      if (error) throw error;
    }
    stats.register_lines += registerLines.length;
  }

  const claireBucket = sortedBuckets.find(
    (b) =>
      b.legacyClientId === 130 &&
      b.periodStart === "2026-08-16" &&
      b.periodEnd === "2026-08-31"
  );
  if (claireBucket) {
    const claireRow = claireBucket.rows.find(
      (r) =>
        String(r.lname2 ?? "").toLowerCase() === "aban" &&
        String(r.fname2 ?? "").toLowerCase().startsWith("claire")
    );
    if (claireRow) {
      console.log("Claire check:", {
        basic: claireRow.basic,
        gross: claireRow.grossalary,
        net: claireRow.netamount,
        thirteenth: claireRow.thirteenmonth,
        ytd: claireRow.ytdthirteenmonth,
        sil: claireRow.silp,
        hours: claireRow.noofhourswork,
      });
    }
  }

  const loanPostsAfter = await publicDb
    .from("payroll_register_loan_posts")
    .select("id", { count: "exact", head: true });
  console.log("\n=== summary ===");
  console.table(stats);
  console.log(
    `payroll_register_loan_posts count before=${loanPostsCountBefore} after=${loanPostsAfter.count ?? 0}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
