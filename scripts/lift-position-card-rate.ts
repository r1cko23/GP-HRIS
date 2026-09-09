/**
 * Lift Directory daily_rate from the person's position card for everyone
 * on a cutoff. Skips people with no position rate. Does not copy billing.
 *
 *   npx tsx scripts/lift-position-card-rate.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7
 *   npx tsx scripts/lift-position-card-rate.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7 --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { planRateFromPositionCard } from "../lib/directory/position-card-rate";

const APPLY = process.argv.includes("--apply");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";

function loadEnvFile(fileName: string) {
  if (!fs.existsSync(fileName)) return;
  for (const line of fs.readFileSync(fileName, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}

async function main() {
  loadEnvFile(path.resolve(__dirname, "..", ".env.local"));
  const cutoffId = process.argv.find((a) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a)
  );
  if (!cutoffId) {
    console.error(
      "usage: npx tsx scripts/lift-position-card-rate.ts <cutoffId> [--apply]"
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing GP-HRIS Supabase env");
  const hris = createClient(url, key, { auth: { persistSession: false } });
  const directory = hris.schema("directory");

  const { data: hours, error: hErr } = await hris
    .from("cutoff_hours")
    .select("directory_employee_id, last_name, first_name")
    .eq("cutoff_period_id", cutoffId);
  if (hErr) throw new Error(hErr.message);

  const ids = [
    ...new Set(
      (hours ?? [])
        .map((row) => (row.directory_employee_id as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];
  if (!ids.length) throw new Error("No Directory people on this cutoff");

  const { data: people, error: pErr } = await directory
    .from("employees")
    .select(
      "id, last_name, first_name, employee_code, daily_rate, billing_daily_rate, position_id"
    )
    .eq("organization_id", DEPLOYED_ORG)
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);

  const positionIds = [
    ...new Set(
      (people ?? [])
        .map((row) => (row.position_id as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];
  const positionById = new Map<string, number | null>();
  if (positionIds.length) {
    const { data: positions, error: posErr } = await directory
      .from("positions")
      .select("id, payroll_daily_rate")
      .in("id", positionIds);
    if (posErr) throw new Error(posErr.message);
    for (const row of positions ?? []) {
      positionById.set(
        row.id as string,
        (row.payroll_daily_rate as number | null) ?? null
      );
    }
  }

  console.log(`${APPLY ? "APPLY" : "DRY"} cutoff ${cutoffId} · ${ids.length} people`);
  const counts = { lift: 0, noop: 0, skip: 0 };

  for (const person of people ?? []) {
    const posId = (person.position_id as string | null) ?? null;
    const plan = planRateFromPositionCard({
      employeeId: person.id as string,
      employee_code: (person.employee_code as string | null) ?? null,
      daily_rate: person.daily_rate as number | null,
      position_payroll_daily_rate: posId ? positionById.get(posId) ?? null : null,
    });
    counts[plan.action] += 1;
    const name = `${person.last_name}, ${person.first_name}`;
    if (plan.action === "lift") {
      console.log(
        `  lift ${name}  ${person.employee_code}  ${person.daily_rate} → ${plan.daily_rate}`
      );
      if (!APPLY) continue;
      const { error: updErr } = await directory
        .from("employees")
        .update({
          daily_rate: plan.daily_rate,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", DEPLOYED_ORG)
        .eq("id", plan.employeeId);
      if (updErr) throw new Error(`${name}: ${updErr.message}`);
      const { error: movErr } = await directory.from("employee_movements").insert({
        organization_id: DEPLOYED_ORG,
        employee_id: plan.employeeId,
        date_from: new Date().toISOString().slice(0, 10),
        date_to: null,
        status: "RATE_FROM_POSITION_CARD",
        department: null,
        position: null,
        remarks: `Lifted daily_rate ${person.daily_rate} → ${plan.daily_rate} from position card. Kept employee_code ${plan.keep_employee_code}. Billing not copied.`,
      });
      if (movErr) throw new Error(`${name} movement: ${movErr.message}`);
    } else if (plan.action === "skip") {
      console.log(`  skip ${name}  (${plan.reason})`);
    }
  }

  console.log(counts);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
