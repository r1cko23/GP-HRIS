/**
 * Directory person-file cleaning report.
 * Keeps every 201 row. Auto-apply:
 * --apply-split         same person_key, two live files
 * --apply-sss-name      same SSS + matching current names
 * --apply-name-dob      same name+DOB + exactly one last payout
 * Mixed-name SSS and two-paid name+DOB stay a review queue.
 *
 *   npm run dedup:directory:dry
 *   npm run dedup:directory:apply-split
 *   npm run dedup:directory:apply-sss-name
 *   npm run dedup:directory:apply-name-dob
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { applyCollapsePlans } from "../lib/directory/person-dedup-apply";
import {
  classifyDuplicateGroups,
  collapsePlansForRows,
  planCollapseSplitCurrent,
  type DedupPersonRow,
} from "../lib/directory/person-dedup";

const APPLY_SPLIT = process.argv.includes("--apply-split");
const APPLY_SSS_NAME = process.argv.includes("--apply-sss-name");
const APPLY_NAME_DOB = process.argv.includes("--apply-name-dob");

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

const SELECT = [
  "id",
  "organization_id",
  "person_key",
  "employee_code",
  "last_name",
  "first_name",
  "middle_name",
  "birth_date",
  "sss_number",
  "tin",
  "status",
  "hire_date",
  "first_hire_date",
  "resign_date",
  "last_payroll_end",
  "legacy_id",
  "is_current_engagement",
  "superseded_by",
  "client_id",
  "branch_id",
  "position_id",
  "daily_rate",
].join(", ");

async function fetchAll(directory: ReturnType<typeof createClient>) {
  const pageSize = 1000;
  const rows: DedupPersonRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select(SELECT)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DedupPersonRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function sampleGroup(
  members: DedupPersonRow[],
  extra?: { masterId?: string; keep_employee_code?: string | null }
) {
  return {
    ...extra,
    people: members.map((row) => ({
      id: row.id,
      code: row.employee_code,
      name: `${row.last_name}, ${row.first_name}`,
      status: row.status,
      current: row.is_current_engagement,
      hire: row.hire_date,
      last_pay: row.last_payroll_end,
      sss: row.sss_number,
    })),
  };
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");
  const rows = await fetchAll(directory);
  const classified = classifyDuplicateGroups(rows);
  const sssAuto = classified.same_sss.filter((g) => g.confidence === "auto");
  const sssReview = classified.same_sss.filter((g) => g.confidence === "review");
  const nameDobAuto = classified.name_dob.filter((g) => g.confidence === "auto");
  const nameDobReview = classified.name_dob.filter((g) => g.confidence === "review");
  const kinds: Array<"split_current" | "same_sss" | "name_dob"> = APPLY_NAME_DOB
    ? ["name_dob"]
    : APPLY_SSS_NAME
      ? ["same_sss"]
      : APPLY_SPLIT
        ? ["split_current"]
        : ["split_current", "same_sss", "name_dob"];
  const plans = collapsePlansForRows(rows, { kinds });

  const report = {
    mode: APPLY_NAME_DOB
      ? "apply-name-dob"
      : APPLY_SSS_NAME
        ? "apply-sss-name"
        : APPLY_SPLIT
          ? "apply-split"
          : "dry-run",
    employees: rows.length,
    split_current_groups: classified.split_current.length,
    same_sss_auto_groups: sssAuto.length,
    same_sss_review_groups: sssReview.length,
    name_dob_auto_groups: nameDobAuto.length,
    name_dob_review_groups: nameDobReview.length,
    auto_collapses_this_run: plans.length,
    sample_split_current: classified.split_current.slice(0, 5).map((g) => {
      const plan = planCollapseSplitCurrent(g.members);
      return sampleGroup(g.members, {
        masterId: plan.action === "collapse" ? plan.masterId : undefined,
        keep_employee_code:
          plan.action === "collapse" ? plan.keep_employee_code : undefined,
      });
    }),
    sample_sss_auto: sssAuto.slice(0, 8).map((g) => {
      const plan = planCollapseSplitCurrent(g.members);
      return sampleGroup(g.members, {
        masterId: plan.action === "collapse" ? plan.masterId : undefined,
        keep_employee_code:
          plan.action === "collapse" ? plan.keep_employee_code : undefined,
      });
    }),
    sample_sss_review: sssReview.slice(0, 8).map((g) => sampleGroup(g.members)),
    sample_name_dob_auto: nameDobAuto.slice(0, 8).map((g) => {
      const plan = planCollapseSplitCurrent(g.members);
      return sampleGroup(g.members, {
        masterId: plan.action === "collapse" ? plan.masterId : undefined,
        keep_employee_code:
          plan.action === "collapse" ? plan.keep_employee_code : undefined,
      });
    }),
    sample_name_dob_review: nameDobReview.slice(0, 8).map((g) => sampleGroup(g.members)),
    deletes: 0,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY_SPLIT && !APPLY_SSS_NAME && !APPLY_NAME_DOB) {
    console.log(
      "Dry-run only. --apply-split / --apply-sss-name / --apply-name-dob park extras. No deletes. One current 201 per person."
    );
    return;
  }

  const applied = await applyCollapsePlans(directory, plans);
  console.log(JSON.stringify({ applied: true, deletes: 0, ...applied }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
