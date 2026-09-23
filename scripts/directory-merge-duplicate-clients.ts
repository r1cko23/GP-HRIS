/**
 * Merge same-name active+inactive Directory clients onto the active UUID.
 * Retargets employee / tenure / cutoff / billing FKs. Does not delete clients.
 *
 *   npm run merge:directory:clients:dry
 *   npm run merge:directory:clients:apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  planClientNameMerges,
  type ClientMergePlan,
  type MergeClientRow,
} from "../lib/directory/client-merge";

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

async function countEq(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string,
  schema?: "directory" | "public"
) {
  const db = schema === "directory" ? client.schema("directory") : client;
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(`${schema ?? "public"}.${table}: ${error.message}`);
  return count ?? 0;
}

async function retarget(
  client: SupabaseClient,
  table: string,
  column: string,
  fromId: string,
  toId: string,
  schema?: "directory" | "public"
) {
  const db = schema === "directory" ? client.schema("directory") : client;
  const { data, error } = await db
    .from(table)
    .update({ [column]: toId })
    .eq(column, fromId)
    .select("id");
  if (error) throw new Error(`${schema ?? "public"}.${table}: ${error.message}`);
  return data?.length ?? 0;
}

async function applyPlan(admin: SupabaseClient, plan: ClientMergePlan) {
  const directory = admin.schema("directory");
  const counts = {
    employees: await retarget(
      admin,
      "employees",
      "client_id",
      plan.mergeId,
      plan.keepId,
      "directory"
    ),
    employment_tenures: await retarget(
      admin,
      "employment_tenures",
      "client_id",
      plan.mergeId,
      plan.keepId,
      "directory"
    ),
    client_branches: 0,
    client_departments: 0,
    positions: 0,
    public_employees: await retarget(
      admin,
      "employees",
      "directory_client_id",
      plan.mergeId,
      plan.keepId
    ),
    cutoff_periods: await retarget(
      admin,
      "cutoff_periods",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    cutoff_hours: await retarget(
      admin,
      "cutoff_hours",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    cutoff_dtr_punches: await retarget(
      admin,
      "cutoff_dtr_punches",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    billing_runs: await retarget(
      admin,
      "billing_runs",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    payroll_register_runs: await retarget(
      admin,
      "payroll_register_runs",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    payroll_catchup_corrections: await retarget(
      admin,
      "payroll_catchup_corrections",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
    payroll_main_accrual_openings: await retarget(
      admin,
      "payroll_main_accrual_openings",
      "client_id",
      plan.mergeId,
      plan.keepId
    ),
  };

  // Move child catalogs when unique keys allow; skip conflicts.
  for (const table of ["client_branches", "client_departments", "positions"] as const) {
    const { data: children, error } = await directory
      .from(table)
      .select("id")
      .eq("client_id", plan.mergeId);
    if (error) throw new Error(`list ${table}: ${error.message}`);
    let moved = 0;
    for (const child of children ?? []) {
      const { error: moveError } = await directory
        .from(table)
        .update({ client_id: plan.keepId })
        .eq("id", child.id);
      if (moveError) {
        if (moveError.code === "23505" || /unique|duplicate/i.test(moveError.message)) {
          continue;
        }
        throw new Error(`move ${table} ${child.id}: ${moveError.message}`);
      }
      moved += 1;
    }
    counts[table] = moved;
  }

  const note = `Merged into active client ${plan.keepId} (legacy ${plan.keep_legacy_id ?? "—"}; was legacy ${plan.merge_legacy_id ?? "—"})`;
  const { error: markError } = await directory
    .from("clients")
    .update({
      status: "inactive",
      name: `${plan.name} [merged]`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.mergeId);
  if (markError) throw new Error(`mark merged client: ${markError.message}`);

  return { ...counts, note };
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");
  const { data, error } = await directory
    .from("clients")
    .select("id, organization_id, name, status, legacy_id, created_at")
    .order("name");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MergeClientRow[];
  const plans = planClientNameMerges(rows);

  const preview = [];
  for (const plan of plans) {
    preview.push({
      name: plan.name,
      keepId: plan.keepId,
      mergeId: plan.mergeId,
      keep_legacy_id: plan.keep_legacy_id,
      merge_legacy_id: plan.merge_legacy_id,
      employees_on_merge: await countEq(
        admin,
        "employees",
        "client_id",
        plan.mergeId,
        "directory"
      ),
      branches_on_merge: await countEq(
        admin,
        "client_branches",
        "client_id",
        plan.mergeId,
        "directory"
      ),
      cutoff_periods_on_merge: await countEq(
        admin,
        "cutoff_periods",
        "client_id",
        plan.mergeId
      ),
    });
  }

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    clients: rows.length,
    merge_plans: plans.length,
    preview,
    deletes: 0,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log(
      "Dry-run only. --apply retargets FKs onto the active client and renames the inactive twin [merged]. No deletes."
    );
    return;
  }

  const applied = [];
  for (const plan of plans) {
    applied.push({ plan, result: await applyPlan(admin, plan) });
  }
  console.log(JSON.stringify({ applied: true, deletes: 0, results: applied }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
