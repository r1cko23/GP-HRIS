/**
 * Backfill public.employees.directory_employee_id / directory_client_id
 * by matching office employee_id ↔ directory.employees.employee_code.
 *
 * Prefer active Directory rows, then Deployed org, then highest legacy_id.
 * Does not create Directory rows. Dry-run by default; pass --apply to write.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");

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

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

type OfficeRow = {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  directory_employee_id: string | null;
  directory_client_id: string | null;
};

type DirRow = {
  id: string;
  employee_code: string | null;
  client_id: string | null;
  status: string | null;
  organization_id: string;
  legacy_id: number | null;
  first_name: string | null;
  last_name: string | null;
  organizations: { name: string } | { name: string }[] | null;
};

function orgName(row: DirRow): string {
  const org = row.organizations;
  if (Array.isArray(org)) return org[0]?.name ?? "";
  return org?.name ?? "";
}

function rankCandidate(row: DirRow): number {
  let score = 0;
  if ((row.status ?? "").toLowerCase() === "active") score += 100;
  if (orgName(row).toLowerCase() === "deployed") score += 50;
  score += Number(row.legacy_id ?? 0) / 1_000_000;
  return score;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const publicDb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const directory = publicDb.schema("directory");

  const { data: officeRows, error: officeError } = await publicDb
    .from("employees")
    .select("id, employee_id, full_name, directory_employee_id, directory_client_id")
    .order("employee_id");
  if (officeError) throw officeError;

  const office = (officeRows ?? []) as OfficeRow[];
  const codes = [
    ...new Set(
      office
        .map((row) => row.employee_id?.trim())
        .filter((code): code is string => Boolean(code))
    ),
  ];

  const dirByCode = new Map<string, DirRow[]>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await directory
      .from("employees")
      .select(
        "id, employee_code, client_id, status, organization_id, legacy_id, first_name, last_name, organizations(name)"
      )
      .in("employee_code", codes)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data as DirRow[]) {
      const code = row.employee_code?.trim();
      if (!code) continue;
      const list = dirByCode.get(code) ?? [];
      list.push(row);
      dirByCode.set(code, list);
    }
    if (data.length < page) break;
  }

  const linked: Array<{
    office_id: string;
    employee_id: string;
    directory_employee_id: string;
    directory_client_id: string | null;
    candidates: number;
  }> = [];
  const already: string[] = [];
  const unmatched: string[] = [];

  for (const row of office) {
    const code = row.employee_id?.trim();
    if (!code) {
      unmatched.push(row.id);
      continue;
    }
    if (row.directory_employee_id) {
      already.push(code);
      continue;
    }
    const candidates = (dirByCode.get(code) ?? []).slice().sort((a, b) => {
      return rankCandidate(b) - rankCandidate(a);
    });
    if (!candidates.length) {
      unmatched.push(code);
      continue;
    }
    const best = candidates[0]!;
    linked.push({
      office_id: row.id,
      employee_id: code,
      directory_employee_id: best.id,
      directory_client_id: best.client_id,
      candidates: candidates.length,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        office_total: office.length,
        already_linked: already.length,
        to_link: linked.length,
        unmatched: unmatched.length,
        unmatched_sample: unmatched.slice(0, 10),
        multi_candidate: linked.filter((row) => row.candidates > 1).length,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write links.");
    return;
  }

  let updated = 0;
  for (const row of linked) {
    const { error } = await publicDb
      .from("employees")
      .update({
        directory_employee_id: row.directory_employee_id,
        directory_client_id: row.directory_client_id,
      })
      .eq("id", row.office_id);
    if (error) throw error;
    updated += 1;
  }

  console.log(JSON.stringify({ applied: true, updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
