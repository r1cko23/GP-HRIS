/**
 * Export Organic house staff portal login sheet (employee_id + password).
 * Run after YYYYMM recode so employee_id matches new codes.
 *
 *   npx tsx scripts/export-organic-portal-credentials.ts
 *   npx tsx scripts/export-organic-portal-credentials.ts --out tmp/organic-credentials.csv
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

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

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function outPathFromArgs(): string {
  const idx = process.argv.indexOf("--out");
  if (idx >= 0 && process.argv[idx + 1]) {
    return path.resolve(process.cwd(), process.argv[idx + 1]);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), "tmp", `organic-portal-credentials-${stamp}.csv`);
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin
    .from("employees")
    .select(
      "employee_id, employee_code, first_name, last_name, portal_password, status, directory_employee_id"
    )
    .eq("directory_client_id", ORGANIC_CLIENT_ID)
    .not("directory_employee_id", "is", null)
    .order("last_name")
    .order("first_name");

  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((r) => r.status !== "inactive");
  const outFile = outPathFromArgs();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const header = [
    "employee_id",
    "employee_code",
    "last_name",
    "first_name",
    "portal_password",
    "login_note",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.employee_id,
        r.employee_code,
        r.last_name,
        r.first_name,
        r.portal_password ?? "",
        "Username = employee_id; password unchanged unless HR reset",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];

  fs.writeFileSync(outFile, lines.join("\n"), "utf8");

  const yyyymm = rows.filter((r) =>
    /^[0-9]{6}-[0-9]{5}$/.test(String(r.employee_id ?? ""))
  ).length;

  console.log(
    JSON.stringify(
      {
        exported: rows.length,
        yyyymm_format: yyyymm,
        out: outFile,
        warning:
          "Contains portal passwords — keep local; do not commit this file.",
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
