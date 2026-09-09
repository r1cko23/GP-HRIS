/**
 * Assign Directory position cards from CSM Verified position *text*
 * for people on a cutoff with no (or stale) position. Lifts daily_rate
 * from the card. Does not invent a card, copy billing, or change employee_code.
 *
 *   npx tsx scripts/assign-position-from-csm-title.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7
 *   npx tsx scripts/assign-position-from-csm-title.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7 --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { planPositionFromCsmTitle } from "../lib/directory/position-from-csm-title";

const APPLY = process.argv.includes("--apply");
const RETAG = process.argv.includes("--retag");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const DEFAULT_CSM_CLIENT = "70fa7f09-af43-4196-abd1-36047f8dfeaa";
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");

function argValue(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return fallback;
}

function loadEnvFile(fileName: string) {
  const out: Record<string, string> = {};
  if (!fs.existsSync(fileName)) return out;
  for (const line of fs.readFileSync(fileName, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function envClient(env: Record<string, string>, label: string) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing ${label} NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const cutoffId = process.argv.find((a) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a)
  );
  if (!cutoffId) {
    console.error(
      "usage: npx tsx scripts/assign-position-from-csm-title.ts <cutoffId> [--apply]"
    );
    process.exit(1);
  }

  const hrisEnv = loadEnvFile(HRIS_ENV);
  const csmEnv = loadEnvFile(CSM_ENV);
  const hris = envClient(hrisEnv, "GP-HRIS");
  const csm = envClient(csmEnv, "CSM-GP");
  const directory = hris.schema("directory");
  const csmClientId = argValue("--csm-client", DEFAULT_CSM_CLIENT);

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
      "id, last_name, first_name, employee_code, daily_rate, position_id, client_id, branch_id"
    )
    .eq("organization_id", DEPLOYED_ORG)
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);

  const clientIds = [
    ...new Set(
      (people ?? [])
        .map((row) => (row.client_id as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];
  const branchIds = [
    ...new Set(
      (people ?? [])
        .map((row) => (row.branch_id as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];

  const { data: branches, error: bErr } = await directory
    .from("client_branches")
    .select("id, name")
    .in("id", branchIds);
  if (bErr) throw new Error(bErr.message);
  const branchName = new Map(
    (branches ?? []).map((row) => [row.id as string, String(row.name)])
  );

  const { data: cards, error: cErr } = await directory
    .from("positions")
    .select("id, job_title, payroll_daily_rate, client_id")
    .in("client_id", clientIds);
  if (cErr) throw new Error(cErr.message);

  const { data: verified, error: vErr } = await csm
    .from("csm_employees_verified")
    .select("directory_employee_id, position, employee_name")
    .eq("client_id", csmClientId)
    .eq("is_current", true)
    .in("directory_employee_id", ids);
  if (vErr) throw new Error(vErr.message);
  const csmTitle = new Map(
    (verified ?? []).map((row) => [
      String(row.directory_employee_id),
      String(row.position ?? ""),
    ])
  );

  console.log(
    `${APPLY ? "APPLY" : "DRY"} cutoff ${cutoffId} · ${ids.length} people · ${cards?.length ?? 0} cards`
  );
  const counts = { assign: 0, noop: 0, skip: 0 };

  for (const person of people ?? []) {
    const site = branchName.get(String(person.branch_id ?? "")) ?? "";
    if (!RETAG && person.position_id) {
      counts.noop += 1;
      continue;
    }
    const plan = planPositionFromCsmTitle({
      employeeId: person.id as string,
      employee_code: (person.employee_code as string | null) ?? null,
      current_position_id: (person.position_id as string | null) ?? null,
      daily_rate: person.daily_rate as number | null,
      csm_position: csmTitle.get(person.id as string) ?? "",
      destination_site: site,
      cards: (cards ?? [])
        .filter((card) => card.client_id === person.client_id)
        .map((card) => ({
          id: card.id as string,
          job_title: String(card.job_title),
          payroll_daily_rate: card.payroll_daily_rate as number | null,
        })),
    });
    counts[plan.action] += 1;
    const name = `${person.last_name}, ${person.first_name}`;
    if (plan.action === "assign") {
      console.log(
        `  assign ${name}  ${person.employee_code}  ${csmTitle.get(person.id as string)} → ${plan.job_title}  rate ${person.daily_rate} → ${plan.daily_rate}`
      );
      if (!APPLY) continue;
      const { error: updErr } = await directory
        .from("employees")
        .update({
          position_id: plan.position_id,
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
        status: "POSITION_FROM_CSM_TITLE",
        department: null,
        position: plan.job_title,
        remarks: `Assigned ${plan.job_title} from CSM Verified "${csmTitle.get(person.id as string)}". daily_rate ${person.daily_rate} → ${plan.daily_rate}. Kept employee_code ${plan.keep_employee_code}. Billing not copied.`,
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
