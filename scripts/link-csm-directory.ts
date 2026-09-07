/**
 * Link every CSM Client to a unique Directory employer + branch, then
 * Draft/Verified people to directory_employee_id by unique SSS / name.
 *
 *   npx tsx scripts/link-csm-directory.ts
 *   npx tsx scripts/link-csm-directory.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  matchDirectoryPerson,
  matchDirectorySite,
  type DirectoryBranchRef,
  type DirectoryClientRef,
  type DirectoryPersonRef,
} from "../../../CSM-GP/lib/directory-link.ts";

const APPLY = process.argv.includes("--apply");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
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

async function main() {
  const hris = envClient(loadEnvFile(HRIS_ENV), "GP-HRIS");
  const csm = envClient(loadEnvFile(CSM_ENV), "CSM-GP");

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
  const people = await fetchAll<
    DirectoryPersonRef & { client_id: string }
  >("directory.employees", (from, to) =>
    hris
      .schema("directory")
      .from("employees")
      .select("id, client_id, last_name, first_name, sss_number, tin, status")
      .eq("organization_id", DEPLOYED_ORG)
      .eq("is_current_engagement", true)
      .range(from, to)
  );

  const peopleByClientId: Record<string, number> = {};
  const rosterByClient = new Map<string, DirectoryPersonRef[]>();
  for (const person of people) {
    peopleByClientId[person.client_id] = (peopleByClientId[person.client_id] ?? 0) + 1;
    const list = rosterByClient.get(person.client_id) ?? [];
    list.push(person);
    rosterByClient.set(person.client_id, list);
  }

  const csmClients = await fetchAll<{
    id: string;
    client_name: string;
    directory_client_id: string | null;
    directory_branch_id: string | null;
  }>("csm_clients", (from, to) =>
    csm
      .from("csm_clients")
      .select("id, client_name, directory_client_id, directory_branch_id")
      .order("client_name")
      .range(from, to)
  );

  console.log("Sites:");
  const skipped: string[] = [];
  let alreadySites = 0;
  let newSites = 0;
  const linkedClientIds: string[] = [];
  const directoryClientByCsm = new Map<string, string>();

  for (const row of csmClients) {
    if (row.directory_client_id && row.directory_branch_id) {
      alreadySites += 1;
      linkedClientIds.push(row.id);
      directoryClientByCsm.set(row.id, row.directory_client_id);
      continue;
    }
    const hit = matchDirectorySite(row.client_name, dirClients, dirBranches, {
      peopleByClientId,
    });
    if (!hit) {
      skipped.push(row.client_name);
      console.log(`  SKIP ${row.client_name}`);
      continue;
    }
    console.log(`  ${row.client_name} → ${hit.client.name} / ${hit.branch.name}`);
    linkedClientIds.push(row.id);
    directoryClientByCsm.set(row.id, hit.client.id);
    newSites += 1;
    if (APPLY) {
      const { error } = await csm
        .from("csm_clients")
        .update({
          directory_client_id: hit.client.id,
          directory_branch_id: hit.branch.id,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }
  console.log(
    `Sites: ${alreadySites} already · ${newSites} ${APPLY ? "linked" : "would link"} · ${skipped.length} unmatched`
  );

  const drafts = await fetchAll<{
    id: string;
    client_id: string;
    employee_name: string;
    sss_number: string | null;
    tin_number: string | null;
    directory_employee_id: string | null;
  }>("csm_employees_draft", (from, to) =>
    csm
      .from("csm_employees_draft")
      .select("id, client_id, employee_name, sss_number, tin_number, directory_employee_id")
      .range(from, to)
  );
  const verified = await fetchAll<{
    id: string;
    client_id: string;
    employee_name: string;
    sss_number: string | null;
    tin_number: string | null;
    directory_employee_id: string | null;
  }>("csm_employees_verified", (from, to) =>
    csm
      .from("csm_employees_verified")
      .select("id, client_id, employee_name, sss_number, tin_number, directory_employee_id")
      .eq("is_current", true)
      .range(from, to)
  );

  async function linkRows(
    label: string,
    rows: typeof drafts,
    table: "csm_employees_draft" | "csm_employees_verified"
  ) {
    let linked = 0;
    let already = 0;
    let unmatched = 0;
    let noSite = 0;
    for (const row of rows) {
      if (row.directory_employee_id) {
        already += 1;
        continue;
      }
      const directoryClientId = directoryClientByCsm.get(row.client_id);
      if (!directoryClientId) {
        noSite += 1;
        continue;
      }
      const roster = rosterByClient.get(directoryClientId) ?? [];
      const hit = matchDirectoryPerson(row, roster);
      if (!hit?.ok) {
        unmatched += 1;
        continue;
      }
      if (APPLY) {
        const { error } = await csm
          .from(table)
          .update({ directory_employee_id: hit.person.id })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }
      linked += 1;
    }
    console.log(
      `${label}: ${linked} ${APPLY ? "linked" : "would link"} · ${already} already · ${unmatched} unmatched on a linked site · ${noSite} skipped (site unmatched)`
    );
  }

  await linkRows("Draft", drafts, "csm_employees_draft");
  await linkRows("Verified", verified, "csm_employees_verified");

  if (skipped.length) {
    console.log(`Unmatched CSM sites (${skipped.length}): ${skipped.join(" · ")}`);
  }
  if (!APPLY) console.log("Dry-run. Pass --apply to write CSM.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
