/**
 * Unpost trial GP payroll so MAIN loans/YTD can be re-imported.
 * Default: Nabati only. Organic July golden stays unless --include-organic.
 * Default is dry-run. Pass --apply to write.
 *
 *   npx tsx scripts/unpost-trial-payroll.ts
 *   npx tsx scripts/unpost-trial-payroll.ts --apply
 *   npx tsx scripts/unpost-trial-payroll.ts --include-organic --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { planLoanUnpostRestore } from "../lib/payroll-register/unpost-trial";

const APPLY = process.argv.includes("--apply");
const INCLUDE_ORGANIC = process.argv.includes("--include-organic");
const NABATI_CLIENT_ID = "2a44309a-a594-4b1c-848f-c679183fcba3";
const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

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

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  const clientIds = INCLUDE_ORGANIC
    ? [NABATI_CLIENT_ID, ORGANIC_CLIENT_ID]
    : [NABATI_CLIENT_ID];
  console.log(
    INCLUDE_ORGANIC
      ? "Clients: Nabati + Organic house"
      : "Clients: Nabati Batangas trial posts only (Organic July golden left posted)"
  );

  const db = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: periods, error: periodError } = await db
    .from("cutoff_periods")
    .select("id, client_id, period_start, period_end, status")
    .in("client_id", clientIds)
    .eq("status", "posted")
    .order("period_start");
  if (periodError) throw periodError;

  const cutoffIds = (periods ?? []).map((row) => row.id as string);
  if (!cutoffIds.length) {
    console.log("No posted cutoffs in scope.");
    return;
  }

  const { data: runs, error: runError } = await db
    .from("payroll_register_runs")
    .select("id, cutoff_period_id, status, line_count, period_start, period_end")
    .in("cutoff_period_id", cutoffIds);
  if (runError) throw runError;
  const runIds = (runs ?? []).map((row) => row.id as string);

  const { data: posts, error: postError } = runIds.length
    ? await db
        .from("payroll_register_loan_posts")
        .select("id, run_id, loan_id, schedule_id, balance_before, amount, created_at")
        .in("run_id", runIds)
    : { data: [], error: null };
  if (postError) throw postError;

  const { data: billing, error: billError } = await db
    .from("billing_runs")
    .select("id, cutoff_period_id, status, line_count")
    .in("cutoff_period_id", cutoffIds);
  if (billError) throw billError;

  const { data: catchups, error: catchupError } = await db
    .from("payroll_catchup_corrections")
    .select("id, status, amount, apply_cutoff_period_id, source_cutoff_period_id")
    .or(
      `apply_cutoff_period_id.in.(${cutoffIds.join(",")}),source_cutoff_period_id.in.(${cutoffIds.join(",")})`
    );
  if (catchupError) throw catchupError;

  const restores = planLoanUnpostRestore(
    (posts ?? []).map((row) => ({
      loan_id: String(row.loan_id),
      created_at: String(row.created_at),
      balance_before: Number(row.balance_before) || 0,
      schedule_id: (row.schedule_id as string | null) ?? null,
    }))
  );

  console.log("\nPosted cutoffs:");
  for (const period of periods ?? []) {
    const run = (runs ?? []).find((row) => row.cutoff_period_id === period.id);
    console.log(
      `  ${period.period_start}…${period.period_end}  cutoff=${period.id}  run=${run?.id ?? "none"}  lines=${run?.line_count ?? 0}`
    );
  }
  console.log(
    `\nLoan posts ${posts?.length ?? 0} · loans to restore ${restores.length} · billing ${billing?.length ?? 0} · catch-up ${catchups?.length ?? 0}`
  );

  if (!APPLY) return;

  for (const restore of restores) {
    const { error } = await db
      .from("employee_loans")
      .update({
        current_balance: restore.restore_balance,
        is_active: restore.restore_balance > 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", restore.loan_id);
    if (error) throw error;
    if (restore.schedule_ids.length) {
      const { error: schedError } = await db
        .from("employee_loan_schedules")
        .update({
          status: "pending",
          amount_paid: 0,
          posted_run_id: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", restore.schedule_ids);
      if (schedError) throw schedError;
    }
  }

  if (runIds.length) {
    const { error } = await db
      .from("payroll_register_loan_posts")
      .delete()
      .in("run_id", runIds);
    if (error) throw error;
  }

  for (const row of billing ?? []) {
    const { error } = await db
      .from("billing_runs")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "processed");
    if (error) throw error;
  }

  const catchupIds = (catchups ?? []).map((row) => row.id as string);
  if (catchupIds.length) {
    const { error } = await db
      .from("payroll_catchup_corrections")
      .delete()
      .in("id", catchupIds);
    if (error) throw error;
  }

  if (runIds.length) {
    const { error } = await db.from("payroll_register_runs").delete().in("id", runIds);
    if (error) throw error;
  }

  const { error: periodUpdError } = await db
    .from("cutoff_periods")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .in("id", cutoffIds);
  if (periodUpdError) throw periodUpdError;

  console.log("Unposted. Cutoffs are approved — rebuild the register as draft.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
