/**
 * Create Directory Branches for Nabati sites and move people off Manila.
 * Infers site from position job titles (Tr-Ebo(Batangas 600)).
 *
 *   npx tsx scripts/split-nabati-directory-branches.ts
 *   npx tsx scripts/split-nabati-directory-branches.ts --apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  NABATI_SITE_NAMES,
  siteFromJobTitle,
} from "../lib/directory/site-from-job-title";

const APPLY = process.argv.includes("--apply");
const NABATI_CLIENT_ID = "2a44309a-a594-4b1c-848f-c679183fcba3";

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: client, error: clientError } = await db
    .schema("directory")
    .from("clients")
    .select("id, organization_id, name")
    .eq("id", NABATI_CLIENT_ID)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Nabati Directory Client not found");

  const { data: people, error: peopleError } = await db
    .schema("directory")
    .from("employees")
    .select("id, branch_id, position_id, status")
    .eq("client_id", NABATI_CLIENT_ID)
    .eq("is_current_engagement", true);
  if (peopleError) throw new Error(peopleError.message);

  const positionIds = [
    ...new Set(
      (people ?? [])
        .map((row) => row.position_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const titleByPosition = new Map<string, string>();
  for (const ids of chunk(positionIds, 200)) {
    const { data: positions, error } = await db
      .schema("directory")
      .from("positions")
      .select("id, job_title")
      .in("id", ids);
    if (error) throw new Error(error.message);
    for (const pos of positions ?? []) {
      titleByPosition.set(pos.id as string, (pos.job_title as string) ?? "");
    }
  }

  const counts = new Map<string, { total: number; active: number; ids: string[] }>();
  const unmapped: string[] = [];

  for (const row of people ?? []) {
    const title = titleByPosition.get(row.position_id as string) ?? "";
    const site = siteFromJobTitle(title) ?? "unmapped";
    const bucket = counts.get(site) ?? { total: 0, active: 0, ids: [] };
    bucket.total += 1;
    if (row.status === "active") bucket.active += 1;
    bucket.ids.push(row.id as string);
    counts.set(site, bucket);
    if (site === "unmapped") unmapped.push(title || "(no title)");
  }

  console.log(`${client.name} · ${people?.length ?? 0} current engagements`);
  for (const name of [...NABATI_SITE_NAMES, "unmapped"]) {
    const bucket = counts.get(name);
    if (!bucket) continue;
    console.log(`  ${name}: ${bucket.total} (${bucket.active} active)`);
  }
  if (unmapped.length) {
    const sample = [...new Set(unmapped)].slice(0, 12);
    console.log(`  unmapped titles (sample): ${sample.join(" | ")}`);
  }

  if (!APPLY) {
    console.log("Dry-run. Pass --apply to create Branches and move people.");
    return;
  }

  const { data: existingBranches, error: branchError } = await db
    .schema("directory")
    .from("client_branches")
    .select("id, name")
    .eq("client_id", NABATI_CLIENT_ID);
  if (branchError) throw new Error(branchError.message);

  const branchByName = new Map(
    (existingBranches ?? []).map((b) => [b.name as string, b.id as string])
  );

  for (const name of NABATI_SITE_NAMES) {
    if (branchByName.has(name)) continue;
    const { data: created, error } = await db
      .schema("directory")
      .from("client_branches")
      .insert({
        organization_id: client.organization_id,
        client_id: NABATI_CLIENT_ID,
        name,
        location: name,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    branchByName.set(created.name as string, created.id as string);
    console.log(`Created branch ${created.name}`);
  }

  let moved = 0;
  for (const [site, bucket] of counts) {
    if (site === "unmapped") continue;
    const branchId = branchByName.get(site);
    if (!branchId) continue;
    for (const ids of chunk(bucket.ids, 200)) {
      const { error } = await db
        .schema("directory")
        .from("employees")
        .update({ branch_id: branchId })
        .in("id", ids);
      if (error) throw new Error(error.message);
    }
    moved += bucket.ids.length;
    console.log(`Moved ${bucket.ids.length} → ${site}`);
  }

  console.log(`Done. Moved ${moved} people onto site Branches.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
