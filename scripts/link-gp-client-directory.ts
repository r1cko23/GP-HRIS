/**
 * Link every GP-Client site to Directory employer + branch, then period
 * employees to directory_employee_id by unique last+first (and hris
 * legacy_id when present). Timesheet rows have no SSS.
 *
 *   npx tsx scripts/link-gp-client-directory.ts
 *   npx tsx scripts/link-gp-client-directory.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  matchDirectoryPerson,
  matchDirectoryPosition,
  matchDirectorySite,
  type DirectoryBranchRef,
  type DirectoryClientRef,
  type DirectoryPersonRef,
  type DirectoryPositionRef,
} from "../../GP-Client-Attendance-Payroll/src/lib/directory-link.ts";

const APPLY = process.argv.includes("--apply");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const HRIS_ROOT = path.resolve(__dirname, "..");
const CLIENT_ROOT = path.resolve(HRIS_ROOT, "..", "GP-Client-Attendance-Payroll");
const CLIENT_ENV = path.join(CLIENT_ROOT, ".env.local");
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");
const PAGE = 1000;

function loadEnvFile(fileName: string) {
  const filePath = path.isAbsolute(fileName)
    ? fileName
    : path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
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

async function fetchAll<T>(
  label: string,
  page: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

type DirectoryPerson = DirectoryPersonRef & {
  client_id: string;
  legacy_id?: number | string | null;
};

function matchPerson(
  row: { full_name: string; hris_employee_id: number | null },
  roster: DirectoryPerson[]
) {
  if (row.hris_employee_id) {
    const hits = roster.filter(
      (p) => Number(p.legacy_id) === Number(row.hris_employee_id)
    );
    if (hits.length === 1) return { person: hits[0], reason: "legacy_id" as const };
    if (hits.length > 1) return null;
  }
  const hit = matchDirectoryPerson({ employee_name: row.full_name }, roster);
  if (!hit?.ok) return null;
  return { person: hit.person, reason: hit.reason };
}

async function main() {
  const hris = envClient(loadEnvFile(HRIS_ENV), "GP-HRIS");
  const gpClient = envClient(loadEnvFile(CLIENT_ENV), "GP-Client");

  const dirClients = await fetchAll<DirectoryClientRef>("directory.clients", (from, to) =>
    hris
      .schema("directory")
      .from("clients")
      .select("id, name")
      .eq("organization_id", DEPLOYED_ORG)
      .range(from, to)
  );
  const dirBranches = await fetchAll<DirectoryBranchRef>("directory.client_branches", (from, to) =>
    hris
      .schema("directory")
      .from("client_branches")
      .select("id, client_id, name")
      .range(from, to)
  );
  const people = await fetchAll<DirectoryPerson>("directory.employees", (from, to) =>
    hris
      .schema("directory")
      .from("employees")
      .select("id, client_id, last_name, first_name, sss_number, tin, status, legacy_id")
      .eq("organization_id", DEPLOYED_ORG)
      .eq("is_current_engagement", true)
      .range(from, to)
  );
  const positions = await fetchAll<DirectoryPositionRef & { client_id: string }>(
    "directory.positions",
    (from, to) =>
      hris
        .schema("directory")
        .from("positions")
        .select("id, client_id, job_title")
        .eq("organization_id", DEPLOYED_ORG)
        .range(from, to)
  );

  const peopleByClientId: Record<string, number> = {};
  const rosterByClient = new Map<string, DirectoryPerson[]>();
  for (const person of people) {
    peopleByClientId[person.client_id] = (peopleByClientId[person.client_id] ?? 0) + 1;
    const list = rosterByClient.get(person.client_id) ?? [];
    list.push(person);
    rosterByClient.set(person.client_id, list);
  }
  const positionsByClient = new Map<string, DirectoryPositionRef[]>();
  for (const position of positions) {
    const list = positionsByClient.get(position.client_id) ?? [];
    list.push(position);
    positionsByClient.set(position.client_id, list);
  }

  const sites = await fetchAll<{
    id: string;
    name: string;
    directory_client_id: string | null;
    directory_branch_id: string | null;
  }>("gp-client.clients", (from, to) =>
    gpClient
      .from("clients")
      .select("id, name, directory_client_id, directory_branch_id")
      .order("name")
      .range(from, to)
  );

  console.log("Sites:");
  const skipped: string[] = [];
  let alreadySites = 0;
  let newSites = 0;
  const directoryBySite = new Map<
    string,
    { clientId: string; branchId: string }
  >();

  for (const row of sites) {
    if (row.directory_client_id && row.directory_branch_id) {
      alreadySites += 1;
      directoryBySite.set(row.id, {
        clientId: row.directory_client_id,
        branchId: row.directory_branch_id,
      });
      continue;
    }
    const hit = matchDirectorySite(row.name, dirClients, dirBranches, {
      peopleByClientId,
    });
    if (!hit) {
      skipped.push(row.name);
      console.log(`  SKIP ${row.name}`);
      continue;
    }
    console.log(`  ${row.name} → ${hit.client.name} / ${hit.branch.name}`);
    directoryBySite.set(row.id, { clientId: hit.client.id, branchId: hit.branch.id });
    newSites += 1;
    if (APPLY) {
      const { error } = await gpClient
        .from("clients")
        .update({
          directory_client_id: hit.client.id,
          directory_branch_id: hit.branch.id,
          directory_organization_id: DEPLOYED_ORG,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }
  console.log(
    `Sites: ${alreadySites} already · ${newSites} ${APPLY ? "linked" : "would link"} · ${skipped.length} unmatched`
  );

  const periods = await fetchAll<{ id: string; client_id: string }>("gp-client.periods", (from, to) =>
    gpClient.from("periods").select("id, client_id").range(from, to)
  );
  const clientIdByPeriod = new Map(periods.map((p) => [p.id, p.client_id]));

  const employees = await fetchAll<{
    id: string;
    period_id: string;
    full_name: string;
    position: string | null;
    hris_employee_id: number | null;
    directory_employee_id: string | null;
    directory_position_id: string | null;
  }>("gp-client.employees", (from, to) =>
    gpClient
      .from("employees")
      .select("id, period_id, full_name, position, hris_employee_id, directory_employee_id, directory_position_id")
      .range(from, to)
  );

  const ZERO_POS = "00000000-0000-0000-0000-000000000000";
  const claimed = new Set<string>();
  for (const row of employees) {
    if (!row.directory_employee_id) continue;
    claimed.add(
      `${row.period_id}|${row.directory_employee_id}|${row.directory_position_id ?? ZERO_POS}`
    );
  }

  let linked = 0;
  let already = 0;
  let unmatched = 0;
  let noSite = 0;
  let withPosition = 0;
  let duplicateInPeriod = 0;
  const reasons: Record<string, number> = {};

  for (const row of employees) {
    if (row.directory_employee_id) {
      already += 1;
      continue;
    }
    const siteId = clientIdByPeriod.get(row.period_id);
    const site = siteId ? directoryBySite.get(siteId) : undefined;
    if (!site) {
      noSite += 1;
      continue;
    }
    const roster = rosterByClient.get(site.clientId) ?? [];
    const hit = matchPerson(row, roster);
    if (!hit) {
      unmatched += 1;
      continue;
    }
    const position = matchDirectoryPosition(
      row.position ?? "",
      positionsByClient.get(site.clientId) ?? []
    );
    const key = `${row.period_id}|${hit.person.id}|${position?.id ?? ZERO_POS}`;
    if (claimed.has(key)) {
      duplicateInPeriod += 1;
      continue;
    }
    claimed.add(key);
    if (position) withPosition += 1;
    reasons[hit.reason] = (reasons[hit.reason] ?? 0) + 1;
    linked += 1;
    if (APPLY) {
      const { error } = await gpClient
        .from("employees")
        .update({
          directory_employee_id: hit.person.id,
          directory_branch_id: site.branchId,
          directory_position_id: position?.id ?? null,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  console.log(
    `Employees: ${linked} ${APPLY ? "linked" : "would link"} · ${already} already · ${unmatched} unmatched on a linked site · ${noSite} skipped (site unmatched) · ${duplicateInPeriod} duplicate same-person rows in a period · ${withPosition} also got a unique position`
  );
  console.log(
    `Employee match reasons: ${Object.entries(reasons)
      .map(([k, n]) => `${k}=${n}`)
      .join(" · ") || "none"}`
  );
  if (skipped.length) {
    console.log(`Unmatched GP-Client sites (${skipped.length}): ${skipped.join(" · ")}`);
  }
  if (!APPLY) console.log("Dry-run. Pass --apply to write GP-Client.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
