/**
 * Rebuild the draft register for a cutoff, then compare names/amounts
 * to scraped GREENHRISMAIN payroll_summary_uploads (not live SQL Server).
 *
 *   npx tsx scripts/compare-cutoff-to-scraped-payroll.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7
 *   npx tsx scripts/compare-cutoff-to-scraped-payroll.ts 992e9ea5-07e7-454a-bbf0-82040f8807e7 --rebuild
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  compareRegisterToScrapedSummary,
  scrapedPeopleFromParsedEmployees,
  type GpRegisterLineForParity,
} from "../lib/legacy-greenhrismain/payroll-summary-parity";

const REBUILD = process.argv.includes("--rebuild");
const DEPLOYED_ORG = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
const BATANGAS_COMPANY = "NABATI FOOD PHILIPPINES INC. EDD BATANGAS";
const HRIS_ENV = path.resolve(__dirname, "..", ".env.local");

function loadEnvFile(fileName: string) {
  if (!fs.existsSync(fileName)) return;
  for (const line of fs.readFileSync(fileName, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}

async function main() {
  loadEnvFile(HRIS_ENV);
  const cutoffId = process.argv.find((a) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a)
  );
  if (!cutoffId) {
    console.error(
      "usage: npx tsx scripts/compare-cutoff-to-scraped-payroll.ts <cutoffId> [--rebuild]"
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.DIRECTORY_SERVICE_API_KEY;
  if (!url || !key) throw new Error("Missing GP-HRIS Supabase env");
  const hris = createClient(url, key, { auth: { persistSession: false } });

  if (REBUILD) {
    const base = (process.env.DIRECTORY_API_BASE_URL || "http://localhost:3000").replace(
      /\/$/,
      ""
    );
    if (!apiKey) throw new Error("Missing DIRECTORY_SERVICE_API_KEY");
    const res = await fetch(
      `${base}/api/timekeeping/cutoff-periods/${cutoffId}/payroll-run`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-directory-api-key": apiKey,
          "x-organization-id": DEPLOYED_ORG,
        },
        body: JSON.stringify({
          notes: "Draft rebuild after CSM Verified site align",
        }),
      }
    );
    const json = (await res.json()) as { error?: string; data?: { line_count?: number } };
    if (!res.ok) {
      throw new Error(json.error || `rebuild HTTP ${res.status}`);
    }
    console.log(`Rebuilt draft register · lines ${json.data?.line_count ?? "?"}`);
  }

  const { data: period, error: pErr } = await hris
    .from("cutoff_periods")
    .select("id, period_start, period_end, client_id, branch_id, status")
    .eq("id", cutoffId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!period) throw new Error("Cutoff not found");

  const { data: run, error: rErr } = await hris
    .from("payroll_register_runs")
    .select("id, status, line_count, totals")
    .eq("cutoff_period_id", cutoffId)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!run) throw new Error("No register run for this cutoff");

  const { data: lines, error: lErr } = await hris
    .from("payroll_register_lines")
    .select(
      "directory_employee_id, employee_code, last_name, first_name, gross_pay, net_pay, deductions"
    )
    .eq("run_id", run.id)
    .order("last_name");
  if (lErr) throw new Error(lErr.message);

  const gpLines: GpRegisterLineForParity[] = (lines ?? []).map((row) => ({
    directory_employee_id: (row.directory_employee_id as string | null) ?? null,
    employee_code: (row.employee_code as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    first_name: (row.first_name as string | null) ?? null,
    gross_pay: Number(row.gross_pay) || 0,
    net_pay: Number(row.net_pay) || 0,
    deductions: (row.deductions as Record<string, number>) ?? {},
  }));

  const { data: exact } = await hris
    .from("payroll_summary_uploads")
    .select("id, period_start, period_end, source_file_name, parsed_json, employee_count")
    .eq("company_name", BATANGAS_COMPANY)
    .eq("period_start", period.period_start)
    .eq("period_end", period.period_end)
    .eq("status", "ready")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latest } = exact
    ? { data: exact }
    : await hris
        .from("payroll_summary_uploads")
        .select(
          "id, period_start, period_end, source_file_name, parsed_json, employee_count"
        )
        .eq("company_name", BATANGAS_COMPANY)
        .eq("status", "ready")
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();

  console.log(
    `GP cutoff ${period.period_start}…${period.period_end} · register ${run.status} · ${gpLines.length} lines`
  );
  console.log(`GP totals`, run.totals);

  if (!latest) {
    console.log("No scraped Batangas payroll_summary_uploads found.");
    return;
  }

  const parsed = latest.parsed_json as { employees?: Array<Record<string, unknown>> };
  const scraped = scrapedPeopleFromParsedEmployees(parsed.employees ?? []);
  const samePeriod =
    latest.period_start === period.period_start &&
    latest.period_end === period.period_end;
  console.log(
    `Scraped ${latest.source_file_name} ${latest.period_start}…${latest.period_end} · ${scraped.length} people${
      samePeriod ? "" : "  (different cutoff — roster overlap only; amounts will mismatch)"
    }`
  );

  const { rows, summary } = compareRegisterToScrapedSummary({
    gpLines,
    scraped,
  });
  console.log("Parity", {
    match: summary.match,
    mismatch: summary.mismatch,
    gp_only: summary.gp_only,
    scraped_only: summary.scraped_only,
    gp_gross: summary.gp_totals.gross,
    scraped_gross: summary.legacy_totals.gross,
  });
  for (const row of rows) {
    if (row.status === "match" && samePeriod) continue;
    console.log(
      `  ${row.status.padEnd(13)} ${(row.last_name ?? "").padEnd(16)} ${(row.first_name ?? "").padEnd(18)} gp ${row.gp.gross}  scrape ${row.legacy.gross ?? "—"}`
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
