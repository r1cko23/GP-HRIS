/**
 * Lift payroll daily_rate + position from a later duplicate 201 onto the
 * CSM original. Does not create a 201. Does not copy billing_daily_rate.
 *
 *   npx tsx scripts/lift-later-201-rate.ts
 *   npx tsx scripts/lift-later-201-rate.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { planMasterRateFromLater201 } from "../lib/directory/later-201-rate";

const APPLY = process.argv.includes("--apply");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const PAIRS = [
  {
    name: "Añonuevo, Carlo Magno",
    masterId: "3ea58948-d4a0-4f86-aabc-de8554bc3b96",
    laterId: "57a3e19d-91ba-4041-a259-9b87ccaf1ece",
  },
  {
    name: "Rubi, Rence Paul",
    masterId: "0ae476a4-8bbf-4118-b15b-43cd5238e95c",
    laterId: "7a83ae3d-d901-4fcd-851b-4f9cc8706263",
  },
];

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing GP-HRIS Supabase env");
  const directory = createClient(url, key, {
    auth: { persistSession: false },
  }).schema("directory");

  const ids = PAIRS.flatMap((p) => [p.masterId, p.laterId]);
  const { data, error } = await directory
    .from("employees")
    .select("id, employee_code, daily_rate, position_id, billing_daily_rate")
    .eq("organization_id", DEPLOYED_ORG)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row]));

  console.log(APPLY ? "APPLY" : "DRY");
  for (const pair of PAIRS) {
    const master = byId.get(pair.masterId);
    const later = byId.get(pair.laterId);
    if (!master || !later) {
      console.log(`  missing ${pair.name}`);
      continue;
    }
    const plan = planMasterRateFromLater201({
      master: {
        id: master.id as string,
        employee_code: (master.employee_code as string | null) ?? null,
        daily_rate: master.daily_rate as number | null,
        position_id: (master.position_id as string | null) ?? null,
        billing_daily_rate: master.billing_daily_rate as number | null,
      },
      later: {
        id: later.id as string,
        employee_code: (later.employee_code as string | null) ?? null,
        daily_rate: later.daily_rate as number | null,
        position_id: (later.position_id as string | null) ?? null,
        billing_daily_rate: later.billing_daily_rate as number | null,
      },
    });
    console.log(
      `  ${pair.name}  ${master.employee_code} ${master.daily_rate} → ${plan.action === "lift" ? plan.daily_rate : plan.action}`
    );
    if (!APPLY || plan.action !== "lift") continue;

    const { error: updErr } = await directory
      .from("employees")
      .update({
        daily_rate: plan.daily_rate,
        position_id: plan.position_id,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", DEPLOYED_ORG)
      .eq("id", plan.employeeId);
    if (updErr) throw new Error(`${pair.name}: ${updErr.message}`);

    const { error: movErr } = await directory.from("employee_movements").insert({
      organization_id: DEPLOYED_ORG,
      employee_id: plan.employeeId,
      date_from: new Date().toISOString().slice(0, 10),
      date_to: null,
      status: "RATE_FROM_LATER_201",
      department: null,
      position: null,
      remarks: `Lifted daily_rate ${master.daily_rate} → ${plan.daily_rate} and position from later 201 ${pair.laterId}. Kept employee_code ${plan.keep_employee_code}. Billing not copied.`,
    });
    if (movErr) throw new Error(`${pair.name} movement: ${movErr.message}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
