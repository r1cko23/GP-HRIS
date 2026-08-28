/**
 * Scrub Directory employee status + person dedup from GREENHRISMAIN.
 *
 * Fixes the Unrelease→for_release ETL bug, backfills legacy source columns,
 * and marks superseded rehire engagements (same person, multiple employee codes).
 *
 * Does NOT delete 201 history rows.
 *
 *   npm run scrub:directory:dry
 *   npm run scrub:directory:apply
 *
 * Env: SQL_*, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import {
  buildPersonKey,
  compareEngagements,
  mapLegacyEmployeeStatus,
  type DirectoryStatus,
} from "../lib/directory/legacy-status";

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

type LegacyRow = {
  Employee_id: number;
  status: string | null;
  employee_status: string | null;
  verificationstatus: string | null;
  verifiedforverification: string | null;
  finalpaystatus: string | null;
};

type DirRow = {
  id: string;
  organization_id: string;
  legacy_id: number;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date: string | null;
  hire_date: string | null;
  sss_number: string | null;
  tin: string | null;
  status: string;
  person_key: string | null;
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

  const barredRes = await pool.request().query(`SELECT employeeid FROM dbo.barred`);
  const barredIds = new Set<number>(
    (barredRes.recordset as Array<{ employeeid: number }>)
      .map((r) => r.employeeid)
      .filter((id) => Number.isFinite(id))
  );

  const legacyRes = await pool.request().query(`
    SELECT Employee_id, status, employee_status, verificationstatus,
           verifiedforverification, finalpaystatus
    FROM dbo.Employee
    WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')
  `);
  const legacyById = new Map<number, LegacyRow>();
  for (const row of legacyRes.recordset as LegacyRow[]) {
    legacyById.set(row.Employee_id, row);
  }

  const dirRows: DirRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error: dirError } = await directory
      .from("employees")
      .select(
        "id, organization_id, legacy_id, employee_code, last_name, first_name, middle_name, birth_date, hire_date, sss_number, tin, status, person_key"
      )
      .order("legacy_id")
      .range(from, from + pageSize - 1);
    if (dirError) throw dirError;
    if (!data?.length) break;
    dirRows.push(...(data as DirRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const statusChanges: Array<{
    id: string;
    legacy_id: number;
    from: string;
    to: DirectoryStatus;
    finalpay: string | null;
  }> = [];

  const patches: Array<Record<string, unknown>> = [];

  for (const row of dirRows) {
    const legacy = legacyById.get(row.legacy_id);
    if (!legacy) continue;

    const normalized = mapLegacyEmployeeStatus(
      {
        Employee_id: legacy.Employee_id,
        status: legacy.status,
        employee_status: legacy.employee_status,
        verificationstatus: legacy.verificationstatus,
        verifiedforverification: legacy.verifiedforverification,
        finalpaystatus: legacy.finalpaystatus,
      },
      barredIds
    );

    const personKey = buildPersonKey({
      legacy_id: row.legacy_id,
      sss_number: row.sss_number,
      tin: row.tin,
      birth_date: row.birth_date,
      last_name: row.last_name,
      first_name: row.first_name,
      middle_name: row.middle_name,
    });

    if (row.status !== normalized.status) {
      statusChanges.push({
        id: row.id,
        legacy_id: row.legacy_id,
        from: row.status,
        to: normalized.status,
        finalpay: normalized.legacy_final_pay_status,
      });
    }

    patches.push({
      id: row.id,
      organization_id: row.organization_id,
      status: normalized.status,
      legacy_status: normalized.legacy_status,
      legacy_employee_status: normalized.legacy_employee_status,
      legacy_final_pay_status: normalized.legacy_final_pay_status,
      person_key: personKey,
      is_current_engagement: true,
      superseded_by: null,
    });
  }

  // Person dedup: one current engagement per person_key per org
  const byPersonOrg = new Map<string, typeof patches>();
  for (const patch of patches) {
    const key = `${patch.organization_id as string}|${patch.person_key as string}`;
    const list = byPersonOrg.get(key) ?? [];
    list.push(patch);
    byPersonOrg.set(key, list);
  }

  let supersededCount = 0;
  const dirById = new Map(dirRows.map((r) => [r.id, r]));

  for (const group of byPersonOrg.values()) {
    if (group.length <= 1) continue;

    const ranked = [...group].sort((a, b) => {
      const da = dirById.get(a.id as string)!;
      const db = dirById.get(b.id as string)!;
      return compareEngagements(
        {
          status: a.status as string,
          hire_date: da.hire_date,
          legacy_id: da.legacy_id,
          employee_code: da.employee_code,
        },
        {
          status: b.status as string,
          hire_date: db.hire_date,
          legacy_id: db.legacy_id,
          employee_code: db.employee_code,
        }
      );
    });

    const winner = ranked[0];
    for (let i = 1; i < ranked.length; i++) {
      ranked[i].is_current_engagement = false;
      ranked[i].superseded_by = winner.id;
      supersededCount += 1;
    }
  }

  const statusAfter = new Map<string, number>();
  const currentAfter = { total: 0, byStatus: new Map<string, number>() };

  for (const patch of patches) {
    statusAfter.set(
      patch.status as string,
      (statusAfter.get(patch.status as string) ?? 0) + 1
    );
    if (patch.is_current_engagement) {
      currentAfter.total += 1;
      currentAfter.byStatus.set(
        patch.status as string,
        (currentAfter.byStatus.get(patch.status as string) ?? 0) + 1
      );
    }
  }

  const statusBefore = new Map<string, number>();
  for (const row of dirRows) {
    statusBefore.set(row.status, (statusBefore.get(row.status) ?? 0) + 1);
  }

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    directory_rows: patches.length,
    legacy_rows_matched: legacyById.size,
    status_rows_changed: statusChanges.length,
    superseded_engagements: supersededCount,
    unique_person_keys: byPersonOrg.size,
    current_engagement_rows: currentAfter.total,
    status_before: Object.fromEntries(statusBefore),
    status_after_all_files: Object.fromEntries(statusAfter),
    status_after_current_engagements: Object.fromEntries(currentAfter.byStatus),
    sample_status_changes: statusChanges.slice(0, 15),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    await pool.close();
    return;
  }

  const BATCH = 50;
  for (let i = 0; i < patches.length; i += BATCH) {
    const batch = patches.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (patch) => {
        const { id, organization_id: _org, ...fields } = patch;
        const { error } = await directory
          .from("employees")
          .update(fields)
          .eq("id", id as string);
        if (error) throw error;
      })
    );
    if ((i + BATCH) % 500 === 0 || i + BATCH >= patches.length) {
      console.log(`updated ${Math.min(i + BATCH, patches.length)} / ${patches.length}`);
    }
  }

  console.log("Scrub apply complete.");
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
