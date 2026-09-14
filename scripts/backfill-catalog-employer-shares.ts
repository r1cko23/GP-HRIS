/**
 * Backfill payroll_register_lines.deductions employer-share fields from
 * GREENHRISMAIN payroll_summary for catalog-mirrored cutoffs.
 *
 *   npx tsx scripts/backfill-catalog-employer-shares.ts
 *   npx tsx scripts/backfill-catalog-employer-shares.ts --apply
 *   npx tsx scripts/backfill-catalog-employer-shares.ts --cutoff <uuid> --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { mainSummaryRowsToRegisterLine } from "../lib/payroll-register/main-summary-to-register-line";
import { MAIN_CATALOG_SOURCE_APP } from "../lib/payroll-register/main-summary-to-register-line";

const APPLY = process.argv.includes("--apply");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return undefined;
}

const CUTOFF_ID = argValue("--cutoff");
const YEAR = Number(argValue("--year") || "2026");

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

function asInt(value: unknown): number {
  return Math.trunc(Number(value ?? 0)) || 0;
}

function asDate(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const ER_KEYS = [
  "sss_er",
  "sss_ecc",
  "sss_wisp_er",
  "philhealth_er",
  "pagibig_er",
] as const;

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");

  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "directory" } }
  );

  type CutoffRow = {
    id: string;
    client_id: string;
    branch_id: string | null;
    period_start: string;
    period_end: string;
  };

  let cutoffsQuery = publicDb
    .from("cutoff_periods")
    .select("id, client_id, branch_id, period_start, period_end")
    .eq("source_app", MAIN_CATALOG_SOURCE_APP);
  if (CUTOFF_ID) cutoffsQuery = cutoffsQuery.eq("id", CUTOFF_ID);
  else {
    cutoffsQuery = cutoffsQuery
      .gte("period_start", `${YEAR}-01-01`)
      .lte("period_start", `${YEAR}-12-31`);
  }
  const { data: cutoffs, error: cutoffError } = await cutoffsQuery;
  if (cutoffError) throw cutoffError;
  if (!cutoffs?.length) {
    console.log("No catalog cutoffs matched.");
    return;
  }
  console.log(`Catalog cutoffs ${cutoffs.length}`);

  const clientIds = [...new Set(cutoffs.map((c) => c.client_id))];
  const { data: clients, error: clientError } = await directory
    .from("clients")
    .select("id, legacy_id")
    .in("id", clientIds);
  if (clientError) throw clientError;
  const clientLegacy = new Map(
    (clients ?? []).map((c) => [c.id as string, c.legacy_id as number | null])
  );

  const branchIds = [
    ...new Set(
      cutoffs.map((c) => c.branch_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const branchLegacy = new Map<string, number | null>();
  for (let i = 0; i < branchIds.length; i += 200) {
    const chunk = branchIds.slice(i, i + 200);
    const { data: branches, error: branchError } = await directory
      .from("client_branches")
      .select("id, legacy_id")
      .in("id", chunk);
    if (branchError) throw branchError;
    for (const row of branches ?? []) {
      branchLegacy.set(row.id as string, row.legacy_id as number | null);
    }
  }

  const pool = await sql.connect({
    server: process.env.SQL_HOST || "10.0.0.222",
    port: Number(process.env.SQL_PORT || 1433),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    connectionTimeout: 60000,
    requestTimeout: 300000,
    options: { encrypt: false, trustServerCertificate: true },
  });

  const mainResult = await pool.request().query(`
    SELECT
      ps.Employee_id,
      ps.idclientp,
      ps.idclientbranchp,
      ps.Date_Start,
      ps.Date_End,
      ps.lname2,
      ps.fname2,
      ps.dailyrate_payroll,
      ps.contributionSSSEE,
      ps.contributionSSSER,
      ps.contributionSSSECC,
      ps.contributionSSSEEpro,
      ps.contributionSSSERpro,
      ps.contributionphilhealthEE,
      ps.contributionphilhealthER,
      ps.contributionPagibigEE,
      ps.contributionPagibigER
    FROM payroll_summary ps
    WHERE ISNULL(ps.posted, '') IN ('Yes', 'Y', 'yes', '1', 'T')
      ${CUTOFF_ID ? "" : `AND YEAR(ps.Date_Start) = ${YEAR}`}
  `);
  await pool.close();

  type PeriodKey = string;
  type ErDeductions = ReturnType<
    typeof mainSummaryRowsToRegisterLine
  >["deductions"];
  const mainByPeriodPerson = new Map<PeriodKey, Map<number, ErDeductions>>();
  const mainByPeriodName = new Map<PeriodKey, Map<string, ErDeductions>>();

  const rowsByPeriodPerson = new Map<
    PeriodKey,
    Map<number, Record<string, unknown>[]>
  >();

  function personKey(last: unknown, first: unknown): string {
    return [last, first]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean)
      .join(", ");
  }

  for (const row of mainResult.recordset as Record<string, unknown>[]) {
    const clientId = asInt(row.idclientp);
    const branchId = asInt(row.idclientbranchp);
    const empId = asInt(row.Employee_id);
    const start = asDate(row.Date_Start);
    const end = asDate(row.Date_End);
    if (!clientId || !empId || !start || !end) continue;
    const key = `${clientId}:${branchId}:${start}:${end}`;
    const byEmp = rowsByPeriodPerson.get(key) ?? new Map();
    const list = byEmp.get(empId) ?? [];
    list.push(row);
    byEmp.set(empId, list);
    rowsByPeriodPerson.set(key, byEmp);
  }

  for (const [key, byEmp] of rowsByPeriodPerson) {
    const erByEmp = new Map<number, ErDeductions>();
    const erByName = new Map<string, ErDeductions>();
    for (const [empId, personRows] of byEmp) {
      const line = mainSummaryRowsToRegisterLine({
        directoryEmployeeId: "backfill",
        rows: personRows,
      });
      erByEmp.set(empId, line.deductions);
      const name = personKey(personRows[0]!.lname2, personRows[0]!.fname2);
      if (name) erByName.set(name, line.deductions);
    }
    mainByPeriodPerson.set(key, erByEmp);
    mainByPeriodName.set(key, erByName);
  }

  const { data: dirEmps, error: dirEmpError } = await directory
    .from("employees")
    .select("id, legacy_id")
    .in("client_id", clientIds);
  if (dirEmpError) throw dirEmpError;
  const legacyByDir = new Map<string, number>();
  for (const row of dirEmps ?? []) {
    const legacy = asInt(row.legacy_id);
    if (!legacy) continue;
    legacyByDir.set(row.id as string, legacy);
  }

  let linesMatched = 0;
  let linesUpdated = 0;
  let linesMissingMain = 0;
  const totalsByCutoff = new Map<
    string,
    { sss_er: number; sss_ecc: number; pagibig_er: number; philhealth_er: number }
  >();

  for (const cutoff of cutoffs as CutoffRow[]) {
    const legacyClient = clientLegacy.get(cutoff.client_id);
    const legacyBranch = cutoff.branch_id
      ? branchLegacy.get(cutoff.branch_id)
      : null;
    if (legacyClient == null || legacyBranch == null) continue;

    const periodKey = `${legacyClient}:${legacyBranch}:${cutoff.period_start}:${cutoff.period_end}`;
    const erByEmp = mainByPeriodPerson.get(periodKey);
    const erByName = mainByPeriodName.get(periodKey);
    if (!erByEmp || !erByName) continue;

    const { data: lines, error: linesError } = await publicDb
      .from("payroll_register_lines")
      .select("id, directory_employee_id, last_name, first_name, deductions")
      .eq("cutoff_period_id", cutoff.id);
    if (linesError) throw linesError;

    const cutoffTotals = {
      sss_er: 0,
      sss_ecc: 0,
      pagibig_er: 0,
      philhealth_er: 0,
    };

    for (const line of lines ?? []) {
      const dirId = line.directory_employee_id as string | null;
      if (!dirId) continue;
      const legacyEmp = legacyByDir.get(dirId);
      let er =
        legacyEmp != null ? erByEmp.get(legacyEmp) : undefined;
      if (!er) {
        const name = personKey(line.last_name, line.first_name);
        er = name ? erByName.get(name) : undefined;
      }
      if (!er) {
        linesMissingMain += 1;
        continue;
      }

      linesMatched += 1;
      cutoffTotals.sss_er += Number(er.sss_er ?? 0);
      cutoffTotals.sss_ecc += Number(er.sss_ecc ?? 0);
      cutoffTotals.pagibig_er += Number(er.pagibig_er ?? 0);
      cutoffTotals.philhealth_er += Number(er.philhealth_er ?? 0);

      const deductions = {
        ...((line.deductions ?? {}) as Record<string, unknown>),
      };
      for (const key of ER_KEYS) {
        if (key in er) deductions[key] = er[key];
      }

      if (!APPLY) continue;
      const { error } = await publicDb
        .from("payroll_register_lines")
        .update({ deductions })
        .eq("id", line.id);
      if (error) throw error;
      linesUpdated += 1;
    }

    totalsByCutoff.set(
      `${cutoff.period_start}–${cutoff.period_end}`,
      cutoffTotals
    );
  }

  console.log({ linesMatched, linesUpdated, linesMissingMain });
  if (CUTOFF_ID && linesMissingMain > 0) {
    const cutoff = cutoffs[0] as CutoffRow;
    const legacyClient = clientLegacy.get(cutoff.client_id);
    const legacyBranch = cutoff.branch_id
      ? branchLegacy.get(cutoff.branch_id)
      : null;
    const periodKey = `${legacyClient}:${legacyBranch}:${cutoff.period_start}:${cutoff.period_end}`;
    const erByEmp = mainByPeriodPerson.get(periodKey);
    let mainSssEr = 0;
    for (const er of erByEmp?.values() ?? []) {
      mainSssEr += Number(er.sss_er ?? 0);
    }
    console.log(
      `Period key ${periodKey} · MAIN people ${erByEmp?.size ?? 0} · MAIN SSS ER ${mainSssEr.toFixed(2)}`
    );
  }
  for (const [label, totals] of totalsByCutoff) {
    console.log(
      `  ${label}: SSS ER ${totals.sss_er.toFixed(2)}, ECC ${totals.sss_ecc.toFixed(2)}, Pag-IBIG ER ${totals.pagibig_er.toFixed(2)}, PhilHealth ER ${totals.philhealth_er.toFixed(2)}`
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
