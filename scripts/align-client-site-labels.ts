/**
 * Plan (and optionally apply) billing print names onto CSM and GP-Client
 * site rows: Directory registered name - branch (see lib/directory/site-label.ts).
 *
 *   npx tsx scripts/align-client-site-labels.ts
 *   npx tsx scripts/align-client-site-labels.ts --nabati-only
 *   npx tsx scripts/align-client-site-labels.ts --nabati-only --apply
 *   npx tsx scripts/align-client-site-labels.ts --all --apply
 *
 * --apply requires --nabati-only or --all. Writes client_name / name plus
 * name_aliases so transmittal sheets still match the old nickname.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  collidingSiteLabels,
  planLinkedSiteLabels,
  type LinkedSiteRow,
  type SiteLabelChange,
} from "../lib/directory/site-label";

const APPLY = process.argv.includes("--apply");
const NABATI_ONLY = process.argv.includes("--nabati-only");
const ALL = process.argv.includes("--all");
const NABATI_CLIENT_ID = "2a44309a-a594-4b1c-848f-c679183fcba3";
const PAGE = 1000;
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
const CLIENT_ENV = path.resolve(
  HRIS_ROOT,
  "..",
  "GP-Client-Attendance-Payroll",
  ".env.local"
);
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");

if (APPLY && !NABATI_ONLY && !ALL) {
  throw new Error("--apply requires --nabati-only or --all");
}

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
  page: (from: number, to: number) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>
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

function printChanges(title: string, rows: SiteLabelChange[]) {
  const changes = rows.filter((row) => !row.unchanged);
  const unlinked = rows.filter((row) => row.reason === "unlinked");
  console.log(
    `\n${title}: ${rows.length} rows · ${changes.length} ${APPLY ? "renamed" : "would rename"} · ${unlinked.length} unlinked`
  );
  for (const row of changes) {
    console.log(`  [${row.reason}] ${row.from}`);
    console.log(`           → ${row.to}`);
    if (row.aliases.length) {
      console.log(`           aliases: ${row.aliases.join(" · ")}`);
    }
  }
  for (const row of unlinked) {
    console.log(`  [unlinked] ${row.from}`);
  }
}

function printCollisions(title: string, rows: SiteLabelChange[]) {
  const hits = collidingSiteLabels(rows.map((row) => ({ id: row.id, to: row.to })));
  if (!hits.length) return [];
  console.log(`\n${title} unique-name collisions:`);
  for (const hit of hits) {
    const names = rows
      .filter((row) => hit.ids.includes(row.id))
      .map((row) => `${row.from} → ${row.to}`);
    console.log(`  ${hit.key}`);
    for (const line of names) console.log(`    ${line}`);
  }
  return hits;
}

function scoped(rows: LinkedSiteRow[]): LinkedSiteRow[] {
  if (!NABATI_ONLY) return rows;
  return rows.filter((row) => row.directoryClientId === NABATI_CLIENT_ID);
}

async function loadDirectory(hris: SupabaseClient) {
  const clients = await fetchAll<{ id: string; name: string }>(
    "directory.clients",
    (from, to) =>
      hris
        .schema("directory")
        .from("clients")
        .select("id, name")
        .range(from, to)
  );
  const branches = await fetchAll<{
    id: string;
    client_id: string;
    name: string;
  }>("directory.client_branches", (from, to) =>
    hris
      .schema("directory")
      .from("client_branches")
      .select("id, client_id, name")
      .range(from, to)
  );
  return { clients, branches };
}

async function applyCsm(csm: SupabaseClient, rows: SiteLabelChange[]) {
  for (const row of rows) {
    if (row.unchanged) continue;
    const { error } = await csm
      .from("csm_clients")
      .update({ client_name: row.to, name_aliases: row.aliases })
      .eq("id", row.id);
    if (error) throw new Error(`CSM ${row.from}: ${error.message}`);
  }
}

async function applyGpClient(gpClient: SupabaseClient, rows: SiteLabelChange[]) {
  const changes = rows.filter((row) => !row.unchanged);
  for (const row of changes) {
    const temp = `__align_${row.id}`;
    const { error } = await gpClient
      .from("clients")
      .update({ name: temp })
      .eq("id", row.id);
    if (error) throw new Error(`GP-Client temp ${row.from}: ${error.message}`);
  }
  for (const row of changes) {
    const { error } = await gpClient
      .from("clients")
      .update({ name: row.to, name_aliases: row.aliases })
      .eq("id", row.id);
    if (error) throw new Error(`GP-Client ${row.from}: ${error.message}`);
  }
}

async function main() {
  const hrisEnv = loadEnvFile(HRIS_ENV);
  const csmEnv = loadEnvFile(CSM_ENV);
  const clientEnv = loadEnvFile(CLIENT_ENV);
  const hris = envClient(hrisEnv, "GP-HRIS");
  const csm = envClient(csmEnv, "CSM-GP");
  const gpClient = envClient(clientEnv, "GP-Client");

  const directory = await loadDirectory(hris);

  const csmRows = (
    await fetchAll<{
      id: string;
      client_name: string;
      name_aliases: string[] | null;
      directory_client_id: string | null;
      directory_branch_id: string | null;
    }>("csm_clients", (from, to) =>
      csm
        .from("csm_clients")
        .select(
          "id, client_name, name_aliases, directory_client_id, directory_branch_id"
        )
        .order("client_name")
        .range(from, to)
    )
  ).map(
    (row): LinkedSiteRow => ({
      id: row.id,
      app: "csm",
      localName: row.client_name,
      directoryClientId: row.directory_client_id,
      directoryBranchId: row.directory_branch_id,
      existingAliases: row.name_aliases,
    })
  );

  const gpRows = (
    await fetchAll<{
      id: string;
      name: string;
      name_aliases: string[] | null;
      directory_client_id: string | null;
      directory_branch_id: string | null;
    }>("gp_clients", (from, to) =>
      gpClient
        .from("clients")
        .select(
          "id, name, name_aliases, directory_client_id, directory_branch_id"
        )
        .order("name")
        .range(from, to)
    )
  ).map(
    (row): LinkedSiteRow => ({
      id: row.id,
      app: "gp_client",
      localName: row.name,
      directoryClientId: row.directory_client_id,
      directoryBranchId: row.directory_branch_id,
      existingAliases: row.name_aliases,
    })
  );

  const csmPlan = planLinkedSiteLabels(scoped(csmRows), directory);
  const gpPlan = planLinkedSiteLabels(scoped(gpRows), directory);

  const scope = NABATI_ONLY ? "Nabati only" : "all linked sites";
  console.log(
    `Billing print names · ${scope} · ${APPLY ? "apply" : "dry-run"}`
  );
  printChanges("CSM", csmPlan);
  printChanges("GP-Client", gpPlan);
  const csmHits = printCollisions("CSM", csmPlan);
  const gpHits = printCollisions("GP-Client", gpPlan);

  if (csmHits.length || gpHits.length) {
    throw new Error(
      `Abort: ${csmHits.length + gpHits.length} unique-name collisions. Fix links or tails before apply.`
    );
  }

  if (APPLY) {
    await applyCsm(csm, csmPlan);
    await applyGpClient(gpClient, gpPlan);
    const wrote = [...csmPlan, ...gpPlan].filter((row) => !row.unchanged).length;
    console.log(`\nWrote ${wrote} names + aliases.`);
    return;
  }

  const would = [...csmPlan, ...gpPlan].filter((row) => !row.unchanged).length;
  console.log(
    `\n${would} names would change. Pass --all --apply to write every linked site.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
