/**
 * Seed directory.barred_employees from directory.employees where status = 'barred'.
 * Use when GREENHRISMAIN SQL is unreachable and the legacy dbo.barred ETL cannot run.
 * Safe to re-run: skips org+employee pairs already present.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Pass --apply to write (dry-run by default).
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
  legacy_id: number | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  clients: { name: string } | { name: string }[] | null;
  positions: { department: string | null } | { department: string | null }[] | null;
};

function relName(
  value: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

function relDept(
  value:
    | { department: string | null }
    | { department: string | null }[]
    | null
    | undefined
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.department ?? null;
  return value.department ?? null;
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  ).schema("directory");

  const barred: Emp[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("employees")
      .select(
        "id, organization_id, legacy_id, last_name, first_name, middle_name, status, clients(name), positions(department)"
      )
      .eq("status", "barred")
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    barred.push(...(data as Emp[]));
    if (data.length < page) break;
  }

  const { count: existingCount, error: existingError } = await admin
    .from("barred_employees")
    .select("*", { count: "exact", head: true });
  if (existingError) throw existingError;

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        barred_status_employees: barred.length,
        barred_table_rows: existingCount ?? 0,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to seed barred_employees.");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  if ((existingCount ?? 0) === 0) {
    const batchSize = 500;
    for (let i = 0; i < barred.length; i += batchSize) {
      const slice = barred.slice(i, i + batchSize);
      const payloads = slice.map((row) => ({
        organization_id: row.organization_id,
        employee_id: row.id,
        last_name: row.last_name,
        first_name: row.first_name,
        middle_name: row.middle_name,
        client_name: relName(row.clients),
        department_name: relDept(row.positions),
        last_payroll: null,
        status: "barred",
        legacy_employee_id: row.legacy_id,
      }));
      const { error } = await admin.from("barred_employees").insert(payloads);
      if (error) throw error;
      inserted += payloads.length;
      console.log(`barred inserted: ${inserted}`);
    }
  } else {
    const batchSize = 200;
    for (let i = 0; i < barred.length; i += batchSize) {
      const slice = barred.slice(i, i + batchSize);
      const payloads = [];
      for (const row of slice) {
        let lookup = admin
          .from("barred_employees")
          .select("id")
          .eq("organization_id", row.organization_id);
        if (row.legacy_id != null) {
          lookup = lookup.eq("legacy_employee_id", row.legacy_id);
        } else {
          lookup = lookup.eq("employee_id", row.id);
        }
        const { data: existing } = await lookup.maybeSingle();
        if (existing?.id) {
          skipped += 1;
          continue;
        }
        payloads.push({
          organization_id: row.organization_id,
          employee_id: row.id,
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          client_name: relName(row.clients),
          department_name: relDept(row.positions),
          last_payroll: null,
          status: "barred",
          legacy_employee_id: row.legacy_id,
        });
      }
      if (!payloads.length) continue;
      const { error } = await admin.from("barred_employees").insert(payloads);
      if (error) throw error;
      inserted += payloads.length;
      console.log(`barred inserted: ${inserted}`);
    }
  }

  console.log(JSON.stringify({ applied: true, inserted, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
