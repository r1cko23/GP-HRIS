/**
 * Fold parked superseded 201s into closed employment_tenures on the master.
 * Does not delete employee rows.
 *
 *   npm run fold:directory:tenures:dry
 *   npm run fold:directory:tenures:apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  planFoldSupersededTenures,
  type SupersededEmployeeEpisode,
} from "../lib/directory/fold-superseded-tenures";
import type { TenureRecord } from "../lib/directory/tenure";

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

async function fetchLosers(directory: ReturnType<typeof createClient>) {
  const pageSize = 1000;
  const rows: SupersededEmployeeEpisode[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select(
        [
          "id",
          "organization_id",
          "superseded_by",
          "hire_date",
          "resign_date",
          "client_id",
          "branch_id",
          "position_id",
          "daily_rate",
          "billing_daily_rate",
          "status",
          "last_payroll_end",
        ].join(", ")
      )
      .eq("is_current_engagement", false)
      .not("superseded_by", "is", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SupersededEmployeeEpisode[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchTenuresForMasters(
  directory: ReturnType<typeof createClient>,
  masterIds: string[]
) {
  const byMaster = new Map<string, TenureRecord[]>();
  for (const id of masterIds) byMaster.set(id, []);
  if (masterIds.length === 0) return byMaster;

  const chunk = 200;
  for (let i = 0; i < masterIds.length; i += chunk) {
    const slice = masterIds.slice(i, i + chunk);
    const { data, error } = await directory
      .from("employment_tenures")
      .select(
        "employee_id, sequence, hire_date, resign_date, client_id, branch_id, position_id, daily_rate, billing_daily_rate, status, final_pay_status, barred_reason, is_current, closed_at"
      )
      .in("employee_id", slice)
      .order("sequence");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const employeeId = String(row.employee_id);
      const list = byMaster.get(employeeId) ?? [];
      list.push({
        sequence: Number(row.sequence),
        hire_date: row.hire_date ?? null,
        resign_date: row.resign_date ?? null,
        client_id: row.client_id ?? null,
        branch_id: row.branch_id ?? null,
        position_id: row.position_id ?? null,
        daily_rate: row.daily_rate ?? null,
        billing_daily_rate: row.billing_daily_rate ?? null,
        status: String(row.status),
        final_pay_status: row.final_pay_status as TenureRecord["final_pay_status"],
        barred_reason: (row.barred_reason ??
          null) as TenureRecord["barred_reason"],
        is_current: Boolean(row.is_current),
        closed_at: row.closed_at ?? null,
      });
      byMaster.set(employeeId, list);
    }
  }
  return byMaster;
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");
  const losers = await fetchLosers(directory);
  const masterIds = [
    ...new Set(losers.map((row) => row.superseded_by).filter(Boolean)),
  ];
  const existing = await fetchTenuresForMasters(directory, masterIds);
  const inserts = planFoldSupersededTenures(losers, existing);

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    superseded_rows: losers.length,
    masters: masterIds.length,
    tenure_inserts: inserts.length,
    sample: inserts.slice(0, 8).map((row) => ({
      master: row.employee_id,
      source: row.source_employee_id,
      sequence: row.sequence,
      hire: row.hire_date,
      client: row.client_id,
      status: row.status,
      final_pay: row.final_pay_status,
    })),
    deletes: 0,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log(
      "Dry-run only. --apply inserts closed tenures on masters. Superseded 201 rows stay on file."
    );
    return;
  }

  let inserted = 0;
  const chunk = 100;
  for (let i = 0; i < inserts.length; i += chunk) {
    const batch = inserts.slice(i, i + chunk).map((row) => {
      const { source_employee_id: _sourceEmployeeId, ...rest } = row;
      return rest;
    });
    const { error } = await directory.from("employment_tenures").insert(batch);
    if (error) throw new Error(error.message);
    inserted += batch.length;
  }
  console.log(JSON.stringify({ applied: true, inserted, deletes: 0 }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
