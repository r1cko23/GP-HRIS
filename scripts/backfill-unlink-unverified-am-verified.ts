/**
 * Unlink CSM Draft / AM Verified Directory links for 201s that have not passed
 * GREENHRISMAIN verification (Pending), or Directory status is for_verification /
 * not Active while CSM still has an active deployment.
 *
 * Does not delete AM Verified roster rows — clears directory_employee_id so AS
 * must re-pick a verified 201 after HR finishes verification in MAIN.
 * Also sets Directory status to for_verification for MAIN Pending legacy_ids.
 *
 *   npm run backfill:unlink-unverified-am:dry
 *   npm run backfill:unlink-unverified-am:apply
 *
 * Env: SQL_* (MAIN), GP-HRIS + CSM-GP .env.local Supabase keys
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import {
  planUnlinkUnverifiedAmVerified,
  type DirectoryPersonForUnlink,
  type CsmLinkedRow,
} from "../lib/directory/unlink-unverified-am-verified";

const APPLY = process.argv.includes("--apply");
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");
const PAGE = 1000;

function loadEnvFile(fileName: string) {
  const filePath = path.isAbsolute(fileName)
    ? fileName
    : path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
    out[key] = value;
  }
  return out;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function envClient(env: Record<string, string> | undefined, label: string) {
  const url = env?.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing ${label} NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchAll<T>(
  label: string,
  page: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

async function loadPendingLegacyIds(): Promise<Set<number>> {
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
    const result = await pool.request().query(`
      SELECT Employee_id
      FROM dbo.Employee
      WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')
        AND verificationstatus IS NOT NULL
        AND LTRIM(RTRIM(CAST(verificationstatus AS nvarchar(100)))) <> ''
        AND verificationstatus <> 'Verified'
    `);
    return new Set(
      (result.recordset as Array<{ Employee_id: number }>).map(
        (row) => row.Employee_id
      )
    );
  } finally {
    await pool.close();
  }
}

async function main() {
  const hrisEnv = loadEnvFile(HRIS_ENV);
  loadEnvFile(".env");
  const csmEnv = loadEnvFile(CSM_ENV);
  const hris = envClient(hrisEnv, "GP-HRIS");
  const csm = envClient(csmEnv, "CSM-GP");

  const pendingLegacyIds = await loadPendingLegacyIds();
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        main_pending_verification: pendingLegacyIds.size,
      },
      null,
      2
    )
  );

  // Include superseded engagements too — AM Verified can still point at an
  // old Pending 201 UUID after person_key collapse marked it non-current.
  const directoryPeople = await fetchAll<DirectoryPersonForUnlink>(
    "directory.employees",
    (from, to) =>
      hris
        .schema("directory")
        .from("employees")
        .select("id, legacy_id, status, last_name, first_name, employee_code")
        .range(from, to)
  );
  const directoryById = new Map(
    directoryPeople.map((row) => [row.id, row] as const)
  );

  const verified = await fetchAll<CsmLinkedRow>(
    "csm_employees_verified",
    (from, to) =>
      csm
        .from("csm_employees_verified")
        .select(
          "id, directory_employee_id, employee_name, employment_status, is_current"
        )
        .not("directory_employee_id", "is", null)
        .range(from, to)
  );
  const draft = await fetchAll<CsmLinkedRow>("csm_employees_draft", (from, to) =>
    csm
      .from("csm_employees_draft")
      .select(
        "id, directory_employee_id, employee_name, employment_status"
      )
      .not("directory_employee_id", "is", null)
      .range(from, to)
  );

  const plan = planUnlinkUnverifiedAmVerified({
    pendingLegacyIds,
    directoryById,
    verified,
    draft,
  });

  const byReason = new Map<string, number>();
  const byTable = new Map<string, number>();
  for (const row of plan) {
    byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    byTable.set(row.table, (byTable.get(row.table) ?? 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        unlink_targets: plan.length,
        by_table: Object.fromEntries(byTable),
        by_reason: Object.fromEntries(byReason),
      },
      null,
      2
    )
  );

  for (const row of plan.slice(0, 50)) {
    console.log(
      `  [${row.table}] ${row.employeeName} · legacy=${row.legacyId ?? "—"} · dir=${row.directoryStatus} · ${row.reason}`
    );
  }
  if (plan.length > 50) console.log(`  … ${plan.length - 50} more`);

  if (!APPLY) {
    console.log(
      "\nDry-run only. Re-run with --apply to clear directory_employee_id and set Directory status for_verification."
    );
    return;
  }

  const pendingDirIds = [
    ...new Set(
      directoryPeople
        .filter(
          (row) =>
            row.legacy_id != null && pendingLegacyIds.has(row.legacy_id)
        )
        .map((row) => row.id)
    ),
  ];
  let statusUpdated = 0;
  for (let i = 0; i < pendingDirIds.length; i += 50) {
    const chunk = pendingDirIds.slice(i, i + 50);
    const { error, count } = await hris
      .schema("directory")
      .from("employees")
      .update({ status: "for_verification" }, { count: "exact" })
      .in("id", chunk)
      .neq("status", "for_verification");
    if (error) throw new Error(`directory status: ${error.message}`);
    statusUpdated += count ?? chunk.length;
  }

  let unlinked = 0;
  for (const row of plan) {
    const { error } = await csm
      .from(row.table)
      .update({ directory_employee_id: null })
      .eq("id", row.rowId);
    if (error) {
      throw new Error(`${row.table} ${row.rowId}: ${error.message}`);
    }
    unlinked += 1;
  }
  console.log(
    JSON.stringify(
      {
        directory_for_verification: statusUpdated,
        csm_unlinked: unlinked,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
