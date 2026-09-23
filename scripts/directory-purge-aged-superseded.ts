/**
 * Dry-run: parked superseded 201s whose last entry is ≥5 years old (BIR floor),
 * and whether they still have hard FKs that would block a future purge.
 *
 * Does NOT delete. Remap + counsel sign-off required before any apply.
 *
 *   npm run purge:directory:aged:dry
 *   npm run purge:directory:aged:dry -- --years=5
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  classifyAgedSuperseded,
  emptySoftRefs,
  type AgedSupersededRow,
  type SoftRefCounts,
} from "../lib/directory/purge-aged-superseded";

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

function parseYears(): number {
  const arg = process.argv.find((a) => a.startsWith("--years="));
  if (!arg) return 5;
  const n = Number(arg.slice("--years=".length));
  if (!Number.isFinite(n) || n < 1 || n > 50) {
    throw new Error(`Invalid --years=${arg}`);
  }
  return Math.floor(n);
}

async function fetchParked(directory: ReturnType<SupabaseClient["schema"]>) {
  const pageSize = 1000;
  const rows: AgedSupersededRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select(
        [
          "id",
          "organization_id",
          "superseded_by",
          "employee_code",
          "last_name",
          "first_name",
          "status",
          "hire_date",
          "resign_date",
          "last_payroll_end",
          "created_at",
        ].join(", ")
      )
      .eq("is_current_engagement", false)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as AgedSupersededRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function countEq(
  client: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  schema?: "directory" | "public"
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  if (ids.length === 0) return counts;

  const db = schema === "directory" ? client.schema("directory") : client;
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await db.from(table).select(column).in(column, slice);
    if (error) throw new Error(`${schema ?? "public"}.${table}: ${error.message}`);
    for (const row of data ?? []) {
      const id = String((row as Record<string, unknown>)[column]);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

async function loadRefs(
  admin: SupabaseClient,
  ids: string[]
): Promise<Map<string, SoftRefCounts>> {
  const map = new Map<string, SoftRefCounts>();
  for (const id of ids) map.set(id, emptySoftRefs());
  if (ids.length === 0) return map;

  const tables: Array<{
    table: string;
    column: string;
    key: keyof SoftRefCounts;
    schema?: "directory" | "public";
  }> = [
    { table: "cutoff_hours", column: "directory_employee_id", key: "cutoff_hours" },
    {
      table: "cutoff_dtr_punches",
      column: "directory_employee_id",
      key: "cutoff_dtr_punches",
    },
    {
      table: "payroll_register_lines",
      column: "directory_employee_id",
      key: "payroll_register_lines",
    },
    {
      table: "payroll_main_accrual_openings",
      column: "directory_employee_id",
      key: "payroll_main_accrual_openings",
    },
    {
      table: "payroll_catchup_corrections",
      column: "directory_employee_id",
      key: "payroll_catchup_corrections",
    },
    { table: "billing_lines", column: "directory_employee_id", key: "billing_lines" },
    { table: "employee_loans", column: "directory_employee_id", key: "employee_loans" },
    {
      table: "employees",
      column: "directory_employee_id",
      key: "public_employees",
    },
    {
      table: "employment_tenures",
      column: "employee_id",
      key: "employment_tenures",
      schema: "directory",
    },
    {
      table: "employee_code_aliases",
      column: "source_employee_id",
      key: "employee_code_aliases_as_source",
      schema: "directory",
    },
  ];

  for (const spec of tables) {
    const counts = await countEq(
      admin,
      spec.table,
      spec.column,
      ids,
      spec.schema
    );
    for (const [id, n] of counts) {
      const refs = map.get(id) ?? emptySoftRefs();
      refs[spec.key] = n;
      map.set(id, refs);
    }
  }
  return map;
}

async function main() {
  const years = parseYears();
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");
  const parked = await fetchParked(directory);
  const asOf = new Date();

  // Pre-filter roughly by year in JS after lastEntryDate via classify —
  // still need refs only for aged candidates. First classify with empty refs
  // to get aged ids, then load refs, then reclassify.
  const prelim = classifyAgedSuperseded(parked, new Map(), {
    asOf,
    retentionYears: years,
  });
  const agedIds = prelim.aged.map((row) => row.id);
  const refs = await loadRefs(admin, agedIds);
  const report = classifyAgedSuperseded(parked, refs, {
    asOf,
    retentionYears: years,
  });

  const out = {
    mode: "dry-run",
    retention_years: report.retention_years,
    as_of: report.as_of,
    parked_total: parked.length,
    too_recent_or_unaged: report.too_recent,
    aged_total: report.aged.length,
    eligible_for_purge_after_remap: report.eligible.length,
    blocked_hard_refs: report.blocked.length,
    eligible_sample: report.eligible.slice(0, 15).map((row) => ({
      id: row.id,
      code: row.employee_code,
      name: row.name,
      master: row.superseded_by,
      last_entry: row.last_entry,
      years: row.years_since_last_entry,
      notes: row.block_reasons.filter((r) => r.startsWith("remap:")),
    })),
    blocked_sample: report.blocked.slice(0, 15).map((row) => ({
      id: row.id,
      code: row.employee_code,
      name: row.name,
      master: row.superseded_by,
      last_entry: row.last_entry,
      years: row.years_since_last_entry,
      reasons: row.block_reasons,
    })),
    deletes: 0,
    note:
      "Dry-run only. Eligible = last entry ≥ retention years, has superseded_by, no cutoff/register/loan/bundy hard FKs. Remap tenures/aliases on master before any future purge. Counsel sign-off required.",
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
