/**
 * Backfill payroll_register_runs.posted_by_name from GREENHRISMAIN
 * payroll_summary.pcreatedby for catalog-mirrored cutoffs.
 *
 *   npx tsx scripts/backfill-catalog-posted-by-name.ts
 *   npx tsx scripts/backfill-catalog-posted-by-name.ts --apply
 *   npx tsx scripts/backfill-catalog-posted-by-name.ts --year 2026 --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { catalogPostedByName } from "../lib/payroll-register/cutoff-run-by";
import {
  MAIN_CATALOG_NOTES_PREFIX,
  MAIN_CATALOG_SOURCE_APP,
} from "../lib/payroll-register/main-summary-to-register-line";

const APPLY = process.argv.includes("--apply");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return undefined;
}

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

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  console.log(`Backfill catalog posted_by_name · year ${YEAR}`);

  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  type CutoffRow = {
    id: string;
    client_id: string;
    branch_id: string | null;
    period_start: string;
    period_end: string;
  };
  type RunRow = {
    id: string;
    cutoff_period_id: string;
    posted_by_name: string | null;
    notes: string | null;
  };
  type ClientRow = { id: string; legacy_id: number | null };
  type BranchRow = {
    id: string;
    client_id: string;
    legacy_id: number | null;
  };

  const cutoffs: CutoffRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicDb
      .from("cutoff_periods")
      .select("id, client_id, branch_id, period_start, period_end")
      .eq("source_app", MAIN_CATALOG_SOURCE_APP)
      .gte("period_start", `${YEAR}-01-01`)
      .lte("period_start", `${YEAR}-12-31`)
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as CutoffRow[];
    cutoffs.push(...rows);
    if (rows.length < 1000) break;
  }
  console.log(`Catalog cutoffs ${cutoffs.length}`);

  const runs: RunRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicDb
      .from("payroll_register_runs")
      .select("id, cutoff_period_id, posted_by_name, notes")
      .like("notes", `${MAIN_CATALOG_NOTES_PREFIX}%`)
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as RunRow[];
    runs.push(...rows);
    if (rows.length < 1000) break;
  }
  const runByCutoff = new Map(runs.map((run) => [run.cutoff_period_id, run]));

  const clientIds = [...new Set(cutoffs.map((c) => c.client_id))];
  const { data: clients, error: clientError } = await publicDb
    .schema("directory")
    .from("clients")
    .select("id, legacy_id")
    .in("id", clientIds);
  if (clientError) throw clientError;
  const clientLegacy = new Map(
    ((clients ?? []) as ClientRow[]).map((c) => [c.id, c.legacy_id])
  );

  const branchIds = [
    ...new Set(
      cutoffs.map((c) => c.branch_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const branchLegacy = new Map<string, number | null>();
  for (let i = 0; i < branchIds.length; i += 200) {
    const chunk = branchIds.slice(i, i + 200);
    const { data: branches, error: branchError } = await publicDb
      .schema("directory")
      .from("client_branches")
      .select("id, client_id, legacy_id")
      .in("id", chunk);
    if (branchError) throw branchError;
    for (const row of (branches ?? []) as BranchRow[]) {
      branchLegacy.set(row.id, row.legacy_id);
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

  const mainResult = await pool.request().input("year", sql.Int, YEAR).query(`
    SELECT
      ps.idclientp,
      ps.idclientbranchp,
      ps.Date_Start,
      ps.Date_End,
      ps.pcreatedby
    FROM payroll_summary ps
    WHERE YEAR(ps.Date_Start) = @year
      AND ISNULL(ps.posted, '') IN ('Yes', 'Y', 'yes', '1', 'T')
  `);
  await pool.close();

  type MainKey = string;
  const byPeriod = new Map<MainKey, Array<{ pcreatedby?: unknown }>>();
  for (const row of mainResult.recordset as Array<Record<string, unknown>>) {
    const clientId = asInt(row.idclientp);
    const branchId = asInt(row.idclientbranchp);
    const start = asDate(row.Date_Start);
    const end = asDate(row.Date_End);
    if (!clientId || !start || !end) continue;
    const key = `${clientId}:${branchId}:${start}:${end}`;
    const list = byPeriod.get(key) ?? [];
    list.push({ pcreatedby: row.pcreatedby });
    byPeriod.set(key, list);
  }
  console.log(`MAIN period keys ${byPeriod.size}`);

  let matched = 0;
  let updated = 0;
  let skippedHasName = 0;
  let missingMain = 0;
  let missingRun = 0;
  const samples: string[] = [];

  for (const cutoff of cutoffs) {
    const run = runByCutoff.get(cutoff.id);
    if (!run) {
      missingRun += 1;
      continue;
    }
    if (run.posted_by_name?.trim()) {
      skippedHasName += 1;
      continue;
    }
    const legacyClient = clientLegacy.get(cutoff.client_id);
    const legacyBranch = cutoff.branch_id
      ? branchLegacy.get(cutoff.branch_id)
      : null;
    if (legacyClient == null || legacyBranch == null) {
      missingMain += 1;
      continue;
    }
    const key = `${legacyClient}:${legacyBranch}:${cutoff.period_start}:${cutoff.period_end}`;
    const rows = byPeriod.get(key);
    const name = catalogPostedByName(rows ?? []);
    if (!name) {
      missingMain += 1;
      continue;
    }
    matched += 1;
    if (samples.length < 8) {
      samples.push(`${cutoff.period_start}–${cutoff.period_end} → ${name}`);
    }
    if (!APPLY) continue;
    const { error } = await publicDb
      .from("payroll_register_runs")
      .update({
        posted_by_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    if (error) throw error;
    updated += 1;
  }

  console.log({ matched, updated, skippedHasName, missingMain, missingRun });
  for (const sample of samples) console.log(`  ${sample}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
