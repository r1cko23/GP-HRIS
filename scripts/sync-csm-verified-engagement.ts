/**
 * Align Directory Engagement + GP-Client period ids to CSM Verified for one site.
 * Does not create Directory people. Does not dial GREENHRISMAIN.
 *
 *   npx tsx scripts/sync-csm-verified-engagement.ts
 *   npx tsx scripts/sync-csm-verified-engagement.ts --apply
 *
 * Defaults: Nabati Batangas + Aug 16–31 2026 GP-Client period.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { planDirectoryEngagementFromCsm } from "../../../CSM-GP/lib/directory-engagement-plan.ts";
import { isResignedStatus } from "../../../CSM-GP/lib/csm.ts";
import { planPeriodDirectoryStamps } from "../lib/directory/csm-period-stamp";
import {
  engagementLifecycle,
  engagementRehire,
  engagementTransfer,
} from "../lib/directory/engagement";

const APPLY = process.argv.includes("--apply");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const DEFAULT_CSM_CLIENT = "70fa7f09-af43-4196-abd1-36047f8dfeaa";
const DEFAULT_PERIOD = "777a464f-8794-4f12-9b24-60262553939d";
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
const CLIENT_ENV = path.resolve(
  HRIS_ROOT,
  "..",
  "GP-Client-Attendance-Payroll",
  ".env.local"
);
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");
const REMARKS = "CSM Verified backfill · site Engagement";

function argValue(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return fallback;
}

function loadEnvFile(fileName: string) {
  if (!fs.existsSync(fileName)) return;
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(fileName, "utf8").split("\n")) {
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

function envClient(env: Record<string, string> | undefined, label: string) {
  const url = env?.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing ${label} NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const csmClientId = argValue("--csm-client", DEFAULT_CSM_CLIENT);
  const periodId = argValue("--period", DEFAULT_PERIOD);
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

  const hrisEnv = loadEnvFile(HRIS_ENV);
  const csmEnv = loadEnvFile(CSM_ENV);
  const clientEnv = loadEnvFile(CLIENT_ENV);
  const hris = envClient(hrisEnv, "GP-HRIS");
  const csm = envClient(csmEnv, "CSM-GP");
  const gpClient = envClient(clientEnv, "GP-Client");
  const directory = hris.schema("directory") as unknown as SupabaseClient;
  const deps = {
    directory,
    organizationId: DEPLOYED_ORG,
    userId: null,
    autoEnroll: false,
  };

  const { data: site, error: siteErr } = await csm
    .from("csm_clients")
    .select("id, client_name, directory_client_id, directory_branch_id")
    .eq("id", csmClientId)
    .maybeSingle();
  if (siteErr) throw new Error(siteErr.message);
  if (!site?.directory_client_id || !site.directory_branch_id) {
    throw new Error("CSM site is not linked to a Directory Client + Branch");
  }

  const { data: verified, error: verErr } = await csm
    .from("csm_employees_verified")
    .select(
      "employee_name, employment_status, directory_employee_id, is_current"
    )
    .eq("client_id", csmClientId)
    .eq("is_current", true);
  if (verErr) throw new Error(verErr.message);

  const people = verified ?? [];
  const ids = [
    ...new Set(
      people
        .map((row) => (row.directory_employee_id as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];
  const { data: dirRows, error: dirErr } = await directory
    .from("employees")
    .select("id, status, client_id, branch_id")
    .eq("organization_id", DEPLOYED_ORG)
    .in("id", ids);
  if (dirErr) throw new Error(dirErr.message);
  const dirById = new Map(
    (dirRows ?? []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        status: (row.status as string | null) ?? null,
        client_id: (row.client_id as string | null) ?? null,
        branch_id: (row.branch_id as string | null) ?? null,
      },
    ])
  );

  console.log(
    `${APPLY ? "APPLY" : "DRY"} ${site.client_name} · ${people.length} Verified · period ${periodId}`
  );

  const engagementResults: Array<{
    name: string;
    action: string;
    ok?: boolean;
    error?: string;
  }> = [];
  for (const row of people) {
    const plan = planDirectoryEngagementFromCsm({
      kind: isResignedStatus(row.employment_status as string) ? "delete" : "edit",
      directoryEmployeeId: row.directory_employee_id as string | null,
      targetClientId: site.directory_client_id,
      targetBranchId: site.directory_branch_id,
      employmentStatus: row.employment_status as string | null,
      person: dirById.get(String(row.directory_employee_id ?? "")) ?? null,
      today,
    });
    engagementResults.push({
      name: String(row.employee_name),
      action: plan.action === "skip" ? `skip:${plan.reason}` : plan.action,
    });
    if (!APPLY) continue;
    if (plan.action === "skip" || plan.action === "noop") continue;

    let outcome: { ok: boolean; error?: string } = { ok: true };
    if (plan.action === "resign") {
      const r = await engagementLifecycle(deps, plan.employeeId, {
        action: "mark_inactive",
        remarks: REMARKS,
      });
      outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
    } else if (plan.action === "rehire") {
      const r = await engagementRehire(deps, plan.employeeId, {
        hire_date: plan.hire_date,
        client_id: plan.client_id,
        branch_id: plan.branch_id,
        remarks: REMARKS,
      });
      outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
    } else if (plan.action === "activate") {
      const r = await engagementLifecycle(deps, plan.employeeId, {
        action: "activate",
        remarks: REMARKS,
      });
      outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
    } else if (plan.action === "activate_then_transfer") {
      const a = await engagementLifecycle(deps, plan.employeeId, {
        action: "activate",
        remarks: REMARKS,
      });
      if (!a.ok) {
        outcome = { ok: false, error: a.error };
      } else {
        const t = await engagementTransfer(deps, plan.employeeId, {
          client_id: plan.client_id,
          branch_id: plan.branch_id,
          remarks: REMARKS,
        });
        outcome = t.ok ? { ok: true } : { ok: false, error: t.error };
      }
    } else if (plan.action === "transfer") {
      const r = await engagementTransfer(deps, plan.employeeId, {
        client_id: plan.client_id,
        branch_id: plan.branch_id,
        remarks: REMARKS,
      });
      outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    const last = engagementResults[engagementResults.length - 1];
    if (last) {
      last.ok = outcome.ok;
      last.error = outcome.error;
    }
  }

  const { data: periodEmps, error: peErr } = await gpClient
    .from("employees")
    .select("id, full_name, directory_employee_id")
    .eq("period_id", periodId)
    .order("full_name");
  if (peErr) throw new Error(peErr.message);

  const stamps = planPeriodDirectoryStamps(
    (periodEmps ?? []).map((row) => ({
      id: row.id as string,
      full_name: String(row.full_name),
      directory_employee_id: (row.directory_employee_id as string | null) ?? null,
    })),
    people
      .map((row) => ({
        employee_name: String(row.employee_name),
        directory_employee_id: String(row.directory_employee_id ?? "").trim(),
      }))
      .filter((row) => row.directory_employee_id)
  );

  if (APPLY) {
    for (const plan of stamps) {
      if (plan.action !== "stamp") continue;
      const { error } = await gpClient
        .from("employees")
        .update({
          directory_employee_id: plan.directory_employee_id,
          directory_branch_id: site.directory_branch_id,
        })
        .eq("id", plan.id);
      if (error) throw new Error(`stamp ${plan.id}: ${error.message}`);
    }
  }

  const counts = (rows: Array<{ action: string }>) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.action, (map.get(row.action) ?? 0) + 1);
    }
    return Object.fromEntries(map);
  };

  console.log("Directory Engagement:", counts(engagementResults));
  for (const row of engagementResults.filter((r) => r.action !== "noop")) {
    console.log(
      `  ${row.action.padEnd(24)} ${row.name}${row.error ? `  ERROR ${row.error}` : ""}`
    );
  }
  console.log("Period stamps:", counts(stamps.map((s) => ({ action: s.action }))));
  for (const plan of stamps.filter((s) => s.action !== "keep")) {
    if (plan.action === "stamp") {
      console.log(`  stamp ${plan.id} → ${plan.directory_employee_id}`);
    } else {
      console.log(`  skip  ${plan.full_name} (${plan.reason})`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
