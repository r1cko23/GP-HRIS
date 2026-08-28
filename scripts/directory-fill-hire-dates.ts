/**
 * Fill null directory.employees.hire_date / first_hire_date from GREENHRISMAIN datehired.
 *
 *   npm run scrub:directory:hire-dates:dry
 *   npm run scrub:directory:hire-dates:apply
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
  return d.toISOString().slice(0, 10);
}

type DirRow = {
  id: string;
  legacy_id: number | null;
  hire_date: string | null;
  first_hire_date: string | null;
  is_current_engagement: boolean;
};

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
    requestTimeout: 300000,
  });

  const legacyRes = await pool.request().query(`
    SELECT Employee_id, datehired, datehiredtemp, datestart, Date_Reg
    FROM dbo.Employee
    WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')
  `);
  await pool.close();

  const hireByLegacy = new Map<number, string>();
  for (const row of legacyRes.recordset as Array<{
    Employee_id: number;
    datehired: unknown;
    datehiredtemp: unknown;
    datestart: unknown;
    Date_Reg: unknown;
  }>) {
    const d =
      asDate(row.datehired) ??
      asDate(row.datehiredtemp) ??
      asDate(row.datestart) ??
      asDate(row.Date_Reg);
    if (d) hireByLegacy.set(row.Employee_id, d);
  }

  const rows: DirRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select("id, legacy_id, hire_date, first_hire_date, is_current_engagement")
      .is("hire_date", null)
      .not("legacy_id", "is", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DirRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const patches: Array<{
    id: string;
    hire_date: string;
    first_hire_date: string;
  }> = [];
  let noLegacyDate = 0;

  for (const row of rows) {
    if (row.legacy_id == null) continue;
    const hire = hireByLegacy.get(row.legacy_id);
    if (!hire) {
      noLegacyDate += 1;
      continue;
    }
    patches.push({
      id: row.id,
      hire_date: hire,
      first_hire_date: row.first_hire_date ?? hire,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        null_hire_with_legacy_id: rows.length,
        fillable_from_sql: patches.length,
        still_missing_in_sql: noLegacyDate,
        current_engagement_fillable: patches.filter((p) =>
          rows.find((r) => r.id === p.id)?.is_current_engagement
        ).length,
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

  let updated = 0;
  const chunk = 100;
  for (let i = 0; i < patches.length; i += chunk) {
    const slice = patches.slice(i, i + chunk);
    await Promise.all(
      slice.map(async (patch) => {
        const { error } = await directory
          .from("employees")
          .update({
            hire_date: patch.hire_date,
            first_hire_date: patch.first_hire_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", patch.id);
        if (error) throw new Error(`${patch.id}: ${error.message}`);
        updated += 1;
      })
    );
  }

  console.log(JSON.stringify({ applied: true, updated }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
