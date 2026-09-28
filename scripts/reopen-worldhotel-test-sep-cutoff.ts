/**
 * TEST-only: reopen Worldhotel Makati Inc. (TEST) Sep 1–15 regular cutoff
 * so GP-Client hours can be re-ingested and a fresh payroll register built
 * (with cutoff-scoped deductions / allowances).
 *
 *   npx tsx scripts/reopen-worldhotel-test-sep-cutoff.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const CUTOFF_ID = "328e251c-fc97-484d-93f3-52cf709e7336";
const CLIENT_ID = "651c8165-4643-47de-a7d2-7d6ef1970d61";

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(".env.local");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: cutoff, error } = await db
    .from("cutoff_periods")
    .select("id, client_id, period_start, period_end, status, period_kind, source_app")
    .eq("id", CUTOFF_ID)
    .single();
  if (error || !cutoff) throw new Error(error?.message || "Cutoff not found");
  if (cutoff.client_id !== CLIENT_ID) {
    throw new Error("Refusing: cutoff is not Worldhotel TEST");
  }
  if (cutoff.period_kind !== "regular") {
    throw new Error("Refusing: expected regular period_kind");
  }
  console.log("Cutoff before", cutoff);

  const { data: runs, error: runsListErr } = await db
    .from("payroll_register_runs")
    .select("id")
    .eq("cutoff_period_id", CUTOFF_ID);
  if (runsListErr) throw new Error(runsListErr.message);
  const runIds = (runs ?? []).map((r) => r.id);
  if (runIds.length) {
    const { error: loanErr } = await db
      .from("payroll_register_loan_posts")
      .delete()
      .in("run_id", runIds);
    if (loanErr) throw new Error(loanErr.message);
  }

  const { error: lineErr } = await db
    .from("payroll_register_lines")
    .delete()
    .eq("cutoff_period_id", CUTOFF_ID);
  if (lineErr) throw new Error(lineErr.message);

  const { error: runErr } = await db
    .from("payroll_register_runs")
    .delete()
    .eq("cutoff_period_id", CUTOFF_ID);
  if (runErr) throw new Error(runErr.message);

  // Clear standing amounts for this cutoff so the lab starts clean.
  await db
    .from("employee_other_deductions")
    .delete()
    .eq("cutoff_period_id", CUTOFF_ID);
  await db
    .from("employee_allowances")
    .delete()
    .eq("cutoff_period_id", CUTOFF_ID);

  const { data: after, error: upErr } = await db
    .from("cutoff_periods")
    .update({
      status: "draft",
      approved_at: null,
      approved_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CUTOFF_ID)
    .select("id, status, period_start, period_end, period_kind")
    .single();
  if (upErr) throw new Error(upErr.message);

  console.log("Reopened to draft", after);
  console.log(
    `\nOpen: /payroll/${CUTOFF_ID}\nThen: Ingest from GP-Client → Benefits deductions/allowances → Build register`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
