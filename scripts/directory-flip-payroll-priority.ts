/**
 * Flip wrongly parked 201s: when a superseded file has a newer last_payroll_end
 * than the live master (and the master was not hired after that payout), make the
 * paid file current and park the old master under it.
 *
 *   npx tsx scripts/directory-flip-payroll-priority.ts
 *   npx tsx scripts/directory-flip-payroll-priority.ts --apply
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

type Emp = {
  id: string;
  organization_id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  hire_date: string | null;
  last_payroll_end: string | null;
  is_current_engagement: boolean;
  superseded_by: string | null;
};

type Flip = {
  master: Emp;
  paid: Emp;
};

function payKey(value: string | null | undefined): string {
  const key = value?.slice(0, 10) ?? "";
  if (!key || key < "2000-01-01") return "";
  return key;
}

function hireKey(value: string | null | undefined): string {
  const key = value?.slice(0, 10) ?? "";
  if (!key || key < "1990-01-01") return "";
  return key;
}

async function fetchAll(
  directory: ReturnType<typeof createClient>,
  filterCurrent: boolean | null
): Promise<Emp[]> {
  const pageSize = 1000;
  const rows: Emp[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = directory
      .from("employees")
      .select(
        "id, organization_id, employee_code, first_name, last_name, hire_date, last_payroll_end, is_current_engagement, superseded_by"
      )
      .order("id")
      .range(from, from + pageSize - 1);
    if (filterCurrent === true) query = query.eq("is_current_engagement", true);
    if (filterCurrent === false) {
      query = query
        .eq("is_current_engagement", false)
        .not("superseded_by", "is", null);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Emp[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  const [masters, superseded] = await Promise.all([
    fetchAll(directory, true),
    fetchAll(directory, false),
  ]);

  const byMaster = new Map<string, Emp[]>();
  for (const row of superseded) {
    if (!row.superseded_by) continue;
    const list = byMaster.get(row.superseded_by) ?? [];
    list.push(row);
    byMaster.set(row.superseded_by, list);
  }

  const flips: Flip[] = [];
  for (const master of masters) {
    const kids = byMaster.get(master.id) ?? [];
    let best: Emp | null = null;
    const masterPay = payKey(master.last_payroll_end);
    const masterHire = hireKey(master.hire_date);
    for (const kid of kids) {
      const pay = payKey(kid.last_payroll_end);
      if (!pay) continue;
      if (masterPay && pay <= masterPay) continue;
      // New tenure hired after this payout — unpaid master can be correct.
      if (masterHire && masterHire > pay) continue;
      if (
        !best ||
        pay > payKey(best.last_payroll_end) ||
        (pay === payKey(best.last_payroll_end) && kid.id.localeCompare(best.id) < 0)
      ) {
        best = kid;
      }
    }
    if (!best) continue;
    flips.push({ master, paid: best });
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        masters: masters.length,
        superseded: superseded.length,
        flip_count: flips.length,
        sample: flips.slice(0, 20).map(({ master, paid }) => ({
          from_master: `${master.last_name}, ${master.first_name} (${master.employee_code}) pay=${payKey(master.last_payroll_end) || "—"}`,
          to_paid: `${paid.last_name}, ${paid.first_name} (${paid.employee_code}) pay=${payKey(paid.last_payroll_end)}`,
        })),
        includes_nazar: flips.some(
          (f) =>
            f.paid.id === "13fa8ccb-9a47-4164-a9bb-da79181ecfa9" ||
            f.master.id === "6215669e-06a7-4935-91a3-a472380ee058"
        ),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("Dry-run only. Pass --apply to flip live masters onto paid files.");
    return;
  }

  let flipped = 0;
  let retargeted = 0;
  const now = new Date().toISOString();

  for (const { master, paid } of flips) {
    const { error: promoteError } = await directory
      .from("employees")
      .update({
        is_current_engagement: true,
        superseded_by: null,
        updated_at: now,
      })
      .eq("id", paid.id);
    if (promoteError) {
      throw new Error(`promote ${paid.id}: ${promoteError.message}`);
    }

    const { error: parkError } = await directory
      .from("employees")
      .update({
        is_current_engagement: false,
        superseded_by: paid.id,
        updated_at: now,
      })
      .eq("id", master.id);
    if (parkError) {
      throw new Error(`park ${master.id}: ${parkError.message}`);
    }

    const siblings = (byMaster.get(master.id) ?? []).filter(
      (row) => row.id !== paid.id
    );
    for (const sibling of siblings) {
      const { error: retargetError } = await directory
        .from("employees")
        .update({ superseded_by: paid.id, updated_at: now })
        .eq("id", sibling.id);
      if (retargetError) {
        throw new Error(`retarget ${sibling.id}: ${retargetError.message}`);
      }
      retargeted += 1;
    }

    if (master.employee_code) {
      const { error: aliasError } = await directory
        .from("employee_code_aliases")
        .insert({
          organization_id: master.organization_id,
          employee_id: paid.id,
          alias_code: master.employee_code,
          legacy_id: null,
          source_employee_id: master.id,
          note: "Flipped live master onto file with later last_payroll_end",
        });
      if (
        aliasError &&
        aliasError.code !== "23505" &&
        !/unique|duplicate/i.test(aliasError.message)
      ) {
        throw new Error(`alias ${master.employee_code}: ${aliasError.message}`);
      }
    }

    flipped += 1;
  }

  console.log(JSON.stringify({ applied: true, flipped, retargeted }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
