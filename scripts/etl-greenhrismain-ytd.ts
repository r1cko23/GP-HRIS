/**
 * Import latest GREENHRISMAIN 13th / SIL YTD per person (thirteenmonthyear).
 * Default dry-run. Pass --apply to upsert payroll_main_accrual_openings.
 *
 *   npx tsx scripts/etl-greenhrismain-ytd.ts
 *   npx tsx scripts/etl-greenhrismain-ytd.ts --legacy-client 130 --apply
 *   npx tsx scripts/etl-greenhrismain-ytd.ts --all --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import {
  latestAccrualOpenings,
  openingToScrapedAccrual,
  type MainAccrualRow,
} from "../lib/payroll-register/main-ytd-opening";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return undefined;
}

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
  return withRetry("sql.connect", () =>
    sql.connect({
      server: process.env.SQL_HOST || "10.0.0.222",
      port: Number(process.env.SQL_PORT || 1433),
      user: required("SQL_USER"),
      password: required("SQL_PASSWORD"),
      database: process.env.SQL_DATABASE || "GREENHRISMAIN",
      connectionTimeout: 60000,
      requestTimeout: 180000,
      options: { encrypt: false, trustServerCertificate: true },
    })
  );
}

async function loadDirectoryMaps(directory: SupabaseClient) {
  const byLegacyEmp = new Map<number, string>();
  const clientByLegacy = new Map<number, string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await directory
      .from("employees")
      .select("id, legacy_id")
      .not("legacy_id", "is", null)
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      byLegacyEmp.set(Number(row.legacy_id), row.id as string);
    }
    if (data.length < 1000) break;
  }
  const { data: aliases, error: aliasError } = await directory
    .from("employee_code_aliases")
    .select("employee_id, legacy_id");
  if (aliasError) throw aliasError;
  for (const row of aliases ?? []) {
    if (row.legacy_id == null || !row.employee_id) continue;
    if (!byLegacyEmp.has(Number(row.legacy_id))) {
      byLegacyEmp.set(Number(row.legacy_id), row.employee_id as string);
    }
  }
  const { data: clients, error: clientError } = await directory
    .from("clients")
    .select("id, legacy_id")
    .not("legacy_id", "is", null);
  if (clientError) throw clientError;
  for (const row of clients ?? []) {
    clientByLegacy.set(Number(row.legacy_id), row.id as string);
  }
  return { byLegacyEmp, clientByLegacy };
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  const pool = await connectSql();
  const clientFilter = ALL
    ? ""
    : "AND ps.idclientp = @clientId";
  const request = pool.request();
  if (!ALL) request.input("clientId", sql.Int, LEGACY_CLIENT_ID);
  const result = await request.query(`
    SELECT
      ps.Employee_id,
      ps.idclientp,
      ps.Date_Start,
      ps.Date_End,
      ps.basic,
      ps.thirteenmonth,
      ps.ytdthirteenmonth,
      ps.silp,
      ps.thirteenmonthyear,
      ps.lname2,
      ps.fname2
    FROM payroll_summary ps
    INNER JOIN (
      SELECT Employee_id, idclientp, thirteenmonthyear, MAX(Date_End) AS max_end
      FROM payroll_summary
      WHERE thirteenmonthyear IS NOT NULL
        AND thirteenmonthyear >= 2026
      GROUP BY Employee_id, idclientp, thirteenmonthyear
    ) latest
      ON latest.Employee_id = ps.Employee_id
     AND latest.idclientp = ps.idclientp
     AND latest.thirteenmonthyear = ps.thirteenmonthyear
     AND latest.max_end = ps.Date_End
    WHERE ps.thirteenmonthyear >= 2026
      ${clientFilter}
  `);
  await pool.close();

  const rows: MainAccrualRow[] = (result.recordset as Array<Record<string, unknown>>).map(
    (row) => ({
      legacyEmployeeId: asInt(row.Employee_id),
      legacyClientId: asInt(row.idclientp),
      periodStart: asDate(row.Date_Start),
      periodEnd: asDate(row.Date_End),
      basic: asNumber(row.basic),
      thirteenthMonth: asNumber(row.thirteenmonth),
      thirteenthMonthYtd: asNumber(row.ytdthirteenmonth),
      silCutoff: asNumber(row.silp),
      year: asInt(row.thirteenmonthyear) || 2026,
      lastName: String(row.lname2 ?? "").trim(),
      firstName: String(row.fname2 ?? "").trim(),
    })
  );
  const openings = latestAccrualOpenings(rows);
  console.log(
    `MAIN latest rows ${rows.length} · unique people ${openings.length}${ALL ? " (all clients)" : ` (idclientp=${LEGACY_CLIENT_ID})`}`
  );

  const claire = openings.find(
    (row) =>
      row.legacyClientId === 130 &&
      row.lastName.toLowerCase() === "aban" &&
      row.firstName.toLowerCase().startsWith("claire")
  );
  if (claire) {
    console.log(
      `Claire check: ${claire.periodEnd} 13th=${claire.thirteenthMonth} YTD=${claire.thirteenthMonthYtd} SIL=${claire.silCutoff}`
    );
    console.log(openingToScrapedAccrual(claire));
  }

  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = publicDb.schema("directory") as unknown as SupabaseClient;
  const { byLegacyEmp, clientByLegacy } = await loadDirectoryMaps(directory);

  const stats = { matched: 0, skippedNoPerson: 0, skippedNoClient: 0, upserted: 0 };
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of openings) {
    const directoryEmployeeId = byLegacyEmp.get(row.legacyEmployeeId);
    if (!directoryEmployeeId) {
      stats.skippedNoPerson += 1;
      continue;
    }
    const clientId = clientByLegacy.get(row.legacyClientId);
    if (!clientId) {
      stats.skippedNoClient += 1;
      continue;
    }
    stats.matched += 1;
    const key = `${directoryEmployeeId}:${clientId}:${row.year}`;
    const next = {
      directory_employee_id: directoryEmployeeId,
      client_id: clientId,
      legacy_employee_id: row.legacyEmployeeId,
      as_of_period_start: row.periodStart,
      as_of_period_end: row.periodEnd,
      basic: row.basic,
      thirteenth_month: row.thirteenthMonth,
      thirteenth_month_ytd: row.thirteenthMonthYtd,
      sil_cutoff: row.silCutoff,
      thirteenmonthyear: row.year,
      last_name: row.lastName,
      first_name: row.firstName,
      imported_at: new Date().toISOString(),
    };
    const existing = byKey.get(key);
    if (
      !existing ||
      String(next.as_of_period_end) > String(existing.as_of_period_end)
    ) {
      byKey.set(key, next);
    }
  }
  const payload = [...byKey.values()];
  console.log(
    `Directory match ${stats.matched} · no person ${stats.skippedNoPerson} · no client ${stats.skippedNoClient}`
  );

  if (!APPLY) {
    console.log("Dry-run complete.");
    return;
  }

  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await publicDb
      .from("payroll_main_accrual_openings")
      .upsert(chunk, {
        onConflict: "directory_employee_id,client_id,thirteenmonthyear",
      });
    if (error) throw error;
    stats.upserted += chunk.length;
  }
  console.log(`Upserted ${stats.upserted} openings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
