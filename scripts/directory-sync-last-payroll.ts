/**
 * Sync directory.employees.last_payroll_end from GREENHRISMAIN payroll_summary.
 *
 *   npm run sync:directory:last-payroll:dry
 *   npm run sync:directory:last-payroll:apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";

const APPLY = process.argv.includes("--apply");

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

function asDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  const pool = await sql.connect({
    server: required("SQL_HOST"),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: required("SQL_DATABASE"),
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 600000,
  });

  const legacyRes = await pool.request().query(`
    SELECT Employee_id, MAX(Date_End) AS last_end
    FROM dbo.payroll_summary
    WHERE Employee_id IS NOT NULL
      AND Date_End IS NOT NULL
      AND Date_End >= '2000-01-01'
    GROUP BY Employee_id
  `);
  await pool.close();

  const lastByLegacy = new Map<number, string>();
  for (const row of legacyRes.recordset as Array<{
    Employee_id: number;
    last_end: unknown;
  }>) {
    const d = asDate(row.last_end);
    if (d) lastByLegacy.set(row.Employee_id, d);
  }

  const pageSize = 1000;
  const patches: Array<{ id: string; last_payroll_end: string }> = [];
  let scanned = 0;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select("id, legacy_id, last_payroll_end")
      .not("legacy_id", "is", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    scanned += batch.length;
    for (const row of batch) {
      const legacyId = row.legacy_id as number;
      const next = lastByLegacy.get(legacyId);
      if (!next) continue;
      if (row.last_payroll_end === next) continue;
      patches.push({ id: row.id as string, last_payroll_end: next });
    }
    if (batch.length < pageSize) break;
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        payroll_people_in_sql: lastByLegacy.size,
        directory_scanned: scanned,
        to_update: patches.length,
        sample: patches.slice(0, 8),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  const syncedAt = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < patches.length; i += 100) {
    const chunk = patches.slice(i, i + 100);
    await Promise.all(
      chunk.map(async (patch) => {
        const { error } = await directory
          .from("employees")
          .update({
            last_payroll_end: patch.last_payroll_end,
            last_payroll_synced_at: syncedAt,
          })
          .eq("id", patch.id);
        if (error) throw new Error(`${patch.id}: ${error.message}`);
        updated += 1;
      })
    );
    if (i > 0 && i % 2000 === 0) {
      console.log(`updated ${updated}/${patches.length}`);
    }
  }

  console.log(JSON.stringify({ applied: true, updated }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
