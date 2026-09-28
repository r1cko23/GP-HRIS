/**
 * Sync Directory + Nabati Sep GP-Client cutoff daily rates from MAIN payroll_summary.
 *
 *   npx tsx scripts/nabati-sep-sync-rates-from-main.ts           # dry-run
 *   npx tsx scripts/nabati-sep-sync-rates-from-main.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const CUTOFF_ID = "c2513f46-e84f-4816-b872-89dc6ec1c7d3";
const MAIN_RATES = path.join(
  process.cwd(),
  "tmp",
  "sample-match",
  "nabati-main-rates.json"
);

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  loadEnvFile(".env.local");
  const apply = process.argv.includes("--apply");
  const publicDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const directory = publicDb.schema("directory");

  const payload = JSON.parse(fs.readFileSync(MAIN_RATES, "utf8")) as {
    rows: Array<{ employee_id: number; daily_rate: number; last_name: string }>;
  };
  const mainRateByLegacy = new Map(
    payload.rows.map((row) => [Number(row.employee_id), Number(row.daily_rate)])
  );

  const { data: hours, error: hoursError } = await publicDb
    .from("cutoff_hours")
    .select("id, directory_employee_id, daily_rate_payroll, last_name, first_name")
    .eq("cutoff_period_id", CUTOFF_ID);
  if (hoursError) throw new Error(hoursError.message);

  const dirIds = [
    ...new Set(
      (hours ?? [])
        .map((row) => row.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const { data: people, error: peopleError } = await directory
    .from("employees")
    .select("id, legacy_id, daily_rate, last_name, first_name, employee_code")
    .in("id", dirIds);
  if (peopleError) throw new Error(peopleError.message);

  const personById = new Map((people ?? []).map((row) => [row.id as string, row]));
  const changes: Array<{
    directory_employee_id: string;
    legacy_id: number;
    name: string;
    dir_rate: number | null;
    hours_rate: number | null;
    main_rate: number;
    hours_row_id: string;
  }> = [];

  for (const hour of hours ?? []) {
    const dirId = hour.directory_employee_id as string;
    const person = personById.get(dirId);
    if (!person?.legacy_id) continue;
    const legacyId = Number(person.legacy_id);
    const mainRate = mainRateByLegacy.get(legacyId);
    if (mainRate == null || !Number.isFinite(mainRate) || mainRate <= 0) continue;
    const dirRate =
      person.daily_rate == null ? null : round2(Number(person.daily_rate));
    const hoursRate =
      hour.daily_rate_payroll == null
        ? null
        : round2(Number(hour.daily_rate_payroll));
    if (
      (dirRate != null && Math.abs(dirRate - mainRate) <= 0.02) &&
      (hoursRate != null && Math.abs(hoursRate - mainRate) <= 0.02)
    ) {
      continue;
    }
    changes.push({
      directory_employee_id: dirId,
      legacy_id: legacyId,
      name:
        [person.last_name, person.first_name].filter(Boolean).join(", ") ||
        String(hour.last_name ?? ""),
      dir_rate: dirRate,
      hours_rate: hoursRate,
      main_rate: round2(mainRate),
      hours_row_id: hour.id as string,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        cutoff_id: CUTOFF_ID,
        people_on_cutoff: dirIds.length,
        main_rates: mainRateByLegacy.size,
        rate_mismatches: changes.length,
        sample: changes.slice(0, 15).map((row) => ({
          legacy_id: row.legacy_id,
          name: row.name,
          dir: row.dir_rate,
          hours: row.hours_rate,
          main: row.main_rate,
        })),
      },
      null,
      2
    )
  );

  if (!apply || !changes.length) return;

  for (const row of changes) {
    const { error: empError } = await directory
      .from("employees")
      .update({
        daily_rate: row.main_rate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.directory_employee_id);
    if (empError) throw new Error(empError.message);

    const { error: hourError } = await publicDb
      .from("cutoff_hours")
      .update({
        daily_rate_payroll: row.main_rate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.hours_row_id);
    if (hourError) throw new Error(hourError.message);
  }

  console.log(`Updated ${changes.length} Directory + cutoff_hours rates to MAIN.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
