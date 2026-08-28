/**
 * Temporarily revert live employee codes from YYYYMM-##### back to the
 * pre-recode codes stored in employee_code_aliases.
 *
 * Prefer the SQL (one transaction, ~28k rows):
 *   scripts/sql/revert-yyyymm-recode.sql
 *
 * This TS helper is a dry-run reporter + thin apply wrapper notes.
 * Passwords are never touched.
 *
 * Preserves progress:
 * - Local recode script / migration 212 / docs stay untouched
 * - YYYYMM codes saved as deferred aliases for future cutover
 * - Re-run: npm run transform:directory:recode:apply
 *
 *   npm run transform:directory:recode:revert:dry
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const NEW_CODE_RE = /^[0-9]{6}-[0-9]{5}$/;
const RECODE_NOTE_PREFIX = "Former live code before YYYYMM-##### recode → ";

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

async function main() {
  if (process.argv.includes("--apply")) {
    console.error(
      [
        "Do not apply via this TS script (too slow / non-transactional).",
        "Run scripts/sql/revert-yyyymm-recode.sql in Supabase SQL (service role).",
        "Or ask the agent to execute that SQL via MCP.",
      ].join("\n")
    );
    process.exit(1);
  }

  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  let directoryYyyymm = 0;
  let directoryRestorable = 0;
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select("id, employee_code")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const code = row.employee_code as string | null;
      if (!code || !NEW_CODE_RE.test(code)) continue;
      directoryYyyymm += 1;
      const { count, error: aliasError } = await directory
        .from("employee_code_aliases")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", row.id)
        .eq("note", `${RECODE_NOTE_PREFIX}${code}`);
      if (aliasError) throw new Error(aliasError.message);
      if ((count ?? 0) > 0) directoryRestorable += 1;
    }
    if (batch.length < pageSize) break;
  }

  const { data: office, error: officeError } = await admin
    .from("employees")
    .select("id, employee_id, directory_employee_id");
  if (officeError) throw new Error(officeError.message);

  let officeYyyymm = 0;
  let officeRestorable = 0;
  for (const row of office ?? []) {
    const code = row.employee_id as string | null;
    if (!code || !NEW_CODE_RE.test(code)) continue;
    officeYyyymm += 1;
    if (!row.directory_employee_id) continue;
    const { count, error: aliasError } = await directory
      .from("employee_code_aliases")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", row.directory_employee_id)
      .eq("note", `${RECODE_NOTE_PREFIX}${code}`);
    if (aliasError) throw new Error(aliasError.message);
    if ((count ?? 0) > 0) officeRestorable += 1;
  }

  const { count: deferred } = await directory
    .from("employee_code_aliases")
    .select("id", { count: "exact", head: true })
    .eq(
      "note",
      "Deferred YYYYMM-##### after temporary revert — keep for future cutover"
    );

  console.log(
    JSON.stringify(
      {
        mode: "dry-run / status",
        directory_still_yyyymm: directoryYyyymm,
        directory_restorable: directoryRestorable,
        office_still_yyyymm: officeYyyymm,
        office_restorable: officeRestorable,
        deferred_yyyymm_aliases: deferred ?? 0,
        apply_sql: "scripts/sql/revert-yyyymm-recode.sql",
        note:
          directoryYyyymm === 0 && officeYyyymm === 0
            ? "Live IDs already reverted (or never recoded). Login uses pre-YYYYMM codes; passwords unchanged."
            : "Live YYYYMM still present — run the SQL file to revert.",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
