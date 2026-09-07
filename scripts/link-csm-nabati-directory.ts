/**
 * Link CSM Nabati site rows to Directory Client/Branch, then Draft/Verified
 * people to directory_employee_id by unique SSS (then unique name) on that Client.
 *
 *   npx tsx scripts/link-csm-nabati-directory.ts
 *   npx tsx scripts/link-csm-nabati-directory.ts --apply
 *
 * Reads GP-HRIS .env.local and sibling CSM-GP/.env.local
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const NABATI_CLIENT_ID = "2a44309a-a594-4b1c-848f-c679183fcba3";
const HRIS_ROOT = path.resolve(__dirname, "..");
const CSM_ENV = path.resolve(HRIS_ROOT, "..", "..", "CSM-GP", ".env.local");
const HRIS_ENV = path.join(HRIS_ROOT, ".env.local");

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function foldNameTokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastFirstFromCsm(name: string) {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [last, rest = ""] = trimmed.split(",", 2);
    return foldNameTokens(`${last} ${rest}`);
  }
  return foldNameTokens(trimmed);
}

function lastFirstFromDir(person: { last_name: string | null; first_name: string | null }) {
  return foldNameTokens(`${person.last_name ?? ""} ${person.first_name ?? ""}`);
}

const BRANCH_BY_CSM_NAME: Record<string, string> = {
  "nabati baesa": "Baesa",
  "nabati batangas": "Batangas",
  "nabati bicol": "Bicol",
  "nabati cavite": "Cavite",
  "nabati head office": "Head Office",
  "nabati laguna": "Laguna",
  "nabati las pinas": "Las Piñas",
  "nabati lucena": "Lucena",
  "nabati palawan": "Palawan",
  "nabati taytay": "Taytay",
};

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

function foldName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function envClient(env: Record<string, string> | undefined, label: string) {
  const url = env?.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Missing ${label} NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const hrisEnv = loadEnvFile(HRIS_ENV);
  const csmEnv = loadEnvFile(CSM_ENV);
  const hris = envClient(hrisEnv, "GP-HRIS");
  const csm = envClient(csmEnv, "CSM-GP");

  const { data: branches, error: branchError } = await hris
    .schema("directory")
    .from("client_branches")
    .select("id, name")
    .eq("client_id", NABATI_CLIENT_ID);
  if (branchError) throw new Error(branchError.message);
  const branchIdByName = new Map(
    (branches ?? []).map((b) => [b.name as string, b.id as string])
  );

  const { data: csmClients, error: csmClientError } = await csm
    .from("csm_clients")
    .select("id, client_name, directory_client_id, directory_branch_id")
    .ilike("client_name", "Nabati%");
  if (csmClientError) throw new Error(csmClientError.message);

  console.log("Sites:");
  const siteUpdates: Array<{ id: string; branchId: string; name: string }> = [];
  for (const row of csmClients ?? []) {
    const site = BRANCH_BY_CSM_NAME[foldName(row.client_name as string)];
    const branchId = site ? branchIdByName.get(site) : null;
    if (!branchId) {
      console.log(`  SKIP ${row.client_name}`);
      continue;
    }
    console.log(
      `  ${row.client_name} → ${site} ${row.directory_branch_id === branchId ? "(already)" : ""}`
    );
    siteUpdates.push({
      id: row.id as string,
      branchId,
      name: row.client_name as string,
    });
  }

  if (APPLY) {
    for (const u of siteUpdates) {
      const { error } = await csm
        .from("csm_clients")
        .update({
          directory_client_id: NABATI_CLIENT_ID,
          directory_branch_id: u.branchId,
        })
        .eq("id", u.id);
      if (error) throw new Error(error.message);
    }
    console.log(`Linked ${siteUpdates.length} CSM sites.`);
  }

  const { data: people, error: peopleError } = await hris
    .schema("directory")
    .from("employees")
    .select("id, last_name, first_name, sss_number, tin, status, branch_id")
    .eq("client_id", NABATI_CLIENT_ID)
    .eq("is_current_engagement", true);
  if (peopleError) throw new Error(peopleError.message);

  const csmIds = (csmClients ?? []).map((c) => c.id as string);
  const { data: drafts, error: draftError } = await csm
    .from("csm_employees_draft")
    .select("id, client_id, employee_name, sss_number, tin_number, directory_employee_id")
    .in("client_id", csmIds);
  if (draftError) throw new Error(draftError.message);
  const { data: verified, error: verifiedError } = await csm
    .from("csm_employees_verified")
    .select(
      "id, client_id, employee_name, sss_number, tin_number, directory_employee_id, is_current"
    )
    .in("client_id", csmIds)
    .eq("is_current", true);
  if (verifiedError) throw new Error(verifiedError.message);

  async function linkRows(
    label: string,
    rows: Array<{
      id: string;
      client_id: string;
      employee_name: string;
      sss_number: string | null;
      tin_number: string | null;
      directory_employee_id: string | null;
    }>,
    table: "csm_employees_draft" | "csm_employees_verified"
  ) {
    let linked = 0;
    let already = 0;
    let unmatched = 0;
    for (const row of rows) {
      if (row.directory_employee_id) {
        already += 1;
        continue;
      }
      const roster = people ?? [];
      const sss = digitsOnly(row.sss_number);
      let hits =
        sss.length >= 10
          ? roster.filter((p) => digitsOnly(p.sss_number as string | null) === sss)
          : [];
      if (hits.length > 1) {
        const csmName = lastFirstFromCsm(row.employee_name);
        const named = hits.filter((p) => {
          const dir = lastFirstFromDir(p);
          const last = foldNameTokens((p.last_name as string | null) ?? "");
          return last && csmName.includes(last) && dir.split(" ").every((t) => !t || csmName.includes(t) || t.length <= 1);
        });
        const keys = new Set(named.map((p) => lastFirstFromDir(p)));
        const pick = named.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
        hits = named.length >= 1 && keys.size === 1 && pick ? [pick] : [];
      }
      if (hits.length !== 1) {
        const csmName = lastFirstFromCsm(row.employee_name);
        const nameHits = roster.filter((p) => {
          const dir = lastFirstFromDir(p);
          const dirLast = foldNameTokens((p.last_name as string | null) ?? "");
          return dirLast && csmName.includes(dirLast) && dir.split(" ").filter((t) => t.length > 1).every((t) => csmName.includes(t));
        });
        const keys = new Set(nameHits.map((p) => lastFirstFromDir(p)));
        const pick = nameHits.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
        if (nameHits.length >= 1 && keys.size === 1 && pick) {
          hits = [pick];
        } else {
          unmatched += 1;
          continue;
        }
      }
      if (APPLY) {
        const { error } = await csm
          .from(table)
          .update({ directory_employee_id: hits[0].id })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }
      linked += 1;
    }
    console.log(
      `${label}: ${linked} ${APPLY ? "linked" : "would link"} · ${already} already · ${unmatched} unmatched`
    );
  }

  await linkRows("Draft", (drafts ?? []) as never, "csm_employees_draft");
  await linkRows("Verified", (verified ?? []) as never, "csm_employees_verified");

  if (!APPLY) console.log("Dry-run. Pass --apply to write CSM.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
