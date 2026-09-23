/**
 * Directory person-file cleaning report.
 * Keeps every 201 row. Auto-apply:
 * --apply-split         same person_key, two live files
 * --apply-sss-name      same SSS + matching current names
 * --apply-name-dob      same name+DOB + exactly one last payout
 * --apply-ids           split + SSS/TIN/PhilHealth/Pag-IBIG same-name + name+DOB auto
 * Mixed-name ID shares and bank shares stay a review queue.
 *
 *   npm run dedup:directory:dry
 *   npm run dedup:directory:apply-split
 *   npm run dedup:directory:apply-sss-name
 *   npm run dedup:directory:apply-name-dob
 *   npm run dedup:directory:apply-ids
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { applyCollapsePlans } from "../lib/directory/person-dedup-apply";
import {
  AUTO_ID_COLLAPSE_KINDS,
  classifyDuplicateGroups,
  collapsePlansForRows,
  planCollapseSplitCurrent,
  type DedupPersonRow,
  type DuplicateKind,
} from "../lib/directory/person-dedup";

const APPLY_SPLIT = process.argv.includes("--apply-split");
const APPLY_SSS_NAME = process.argv.includes("--apply-sss-name");
const APPLY_NAME_DOB = process.argv.includes("--apply-name-dob");
const APPLY_IDS = process.argv.includes("--apply-ids");

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
  "philhealth_number",
  "pagibig_number",
  "bank_account_no",
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
      tin: row.tin,
      philhealth: row.philhealth_number,
      pagibig: row.pagibig_number,
      bank: row.bank_account_no,
    })),
  };
}

function resolveKinds(): DuplicateKind[] {
  if (APPLY_IDS) return [...AUTO_ID_COLLAPSE_KINDS];
  if (APPLY_NAME_DOB) return ["name_dob"];
  if (APPLY_SSS_NAME) return ["same_sss"];
  if (APPLY_SPLIT) return ["split_current"];
  return [...AUTO_ID_COLLAPSE_KINDS];
}

function resolveMode(): string {
  if (APPLY_IDS) return "apply-ids";
  if (APPLY_NAME_DOB) return "apply-name-dob";
  if (APPLY_SSS_NAME) return "apply-sss-name";
  if (APPLY_SPLIT) return "apply-split";
  return "dry-run";
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
  const kinds = resolveKinds();
  const plans = collapsePlansForRows(rows, { kinds });

  const autoCount = (groups: typeof classified.same_sss) =>
    groups.filter((g) => g.confidence === "auto").length;
  const reviewCount = (groups: typeof classified.same_sss) =>
    groups.filter((g) => g.confidence === "review").length;

  const report = {
    mode: resolveMode(),
    employees: rows.length,
    split_current_groups: classified.split_current.length,
    same_sss_auto_groups: autoCount(classified.same_sss),
    same_sss_review_groups: reviewCount(classified.same_sss),
    same_tin_auto_groups: autoCount(classified.same_tin),
    same_tin_review_groups: reviewCount(classified.same_tin),
    same_philhealth_auto_groups: autoCount(classified.same_philhealth),
    same_philhealth_review_groups: reviewCount(classified.same_philhealth),
    same_pagibig_auto_groups: autoCount(classified.same_pagibig),
    same_pagibig_review_groups: reviewCount(classified.same_pagibig),
    same_bank_review_groups: classified.same_bank.length,
    name_dob_auto_groups: autoCount(classified.name_dob),
    name_dob_review_groups: reviewCount(classified.name_dob),
    auto_collapses_this_run: plans.length,
    sample_split_current: classified.split_current.slice(0, 5).map((g) => {
      const plan = planCollapseSplitCurrent(g.members);
      return sampleGroup(g.members, {
        masterId: plan.action === "collapse" ? plan.masterId : undefined,
        keep_employee_code:
          plan.action === "collapse" ? plan.keep_employee_code : undefined,
      });
    }),
    sample_sss_auto: classified.same_sss
      .filter((g) => g.confidence === "auto")
      .slice(0, 5)
      .map((g) => {
        const plan = planCollapseSplitCurrent(g.members);
        return sampleGroup(g.members, {
          masterId: plan.action === "collapse" ? plan.masterId : undefined,
          keep_employee_code:
            plan.action === "collapse" ? plan.keep_employee_code : undefined,
        });
      }),
    sample_tin_auto: classified.same_tin
      .filter((g) => g.confidence === "auto")
      .slice(0, 5)
      .map((g) => sampleGroup(g.members)),
    sample_id_review: [
      ...classified.same_sss.filter((g) => g.confidence === "review"),
      ...classified.same_tin.filter((g) => g.confidence === "review"),
      ...classified.same_philhealth.filter((g) => g.confidence === "review"),
      ...classified.same_pagibig.filter((g) => g.confidence === "review"),
      ...classified.same_bank,
    ]
      .slice(0, 8)
      .map((g) => ({ kind: g.kind, ...sampleGroup(g.members) })),
    deletes: 0,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY_SPLIT && !APPLY_SSS_NAME && !APPLY_NAME_DOB && !APPLY_IDS) {
    console.log(
      "Dry-run only. --apply-ids parks SSS/TIN/PhilHealth/Pag-IBIG same-name (+ split + name-dob auto). Bank/mixed-name stay review. No deletes."
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
