/**
 * Organic Sep 1–15 2026 value compare:
 * rebuild draft register from existing non-MAIN cutoff hours,
 * compare to dumped GREENHRISMAIN payroll_summary JSON.
 *
 *   npx tsx scripts/organic-sep-sample-match.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  buildRegisterLine,
  summarizeRegisterLines,
  type CutoffHoursRow,
} from "../lib/payroll-register/compute";
import type { LoanRow } from "../lib/ph-payroll/compute-cutoff-payslip";
import {
  compareRegisterToLegacy,
  type GpRegisterLineForParity,
  type LegacyPayrollSummaryRow,
} from "../lib/legacy-greenhrismain/payroll-summary-parity";

const ORGANIC_ORG_ID = "5edc1024-c785-4044-9a7e-758d422ccba6";
const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";
const CUTOFF_ID = "eee7a838-726b-429d-b535-6f883ce3b08b";
const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-15";
const MAIN_DUMP = path.join(
  process.cwd(),
  "tmp",
  "sample-match",
  "organic-2026-09-01_2026-09-15-main.json"
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function buildDraftRegister(
  publicDb: SupabaseClient,
  period: {
    id: string;
    organization_id: string;
    client_id: string;
    period_start: string;
    period_end: string;
    payroll_date: string | null;
  }
) {
  const { data: hours, error: hoursError } = await publicDb
    .from("cutoff_hours")
    .select("*")
    .eq("cutoff_period_id", period.id)
    .order("last_name");
  if (hoursError) throw new Error(hoursError.message);

  const mainSourced = (hours ?? []).filter((row) =>
    String(row.source_of_data ?? "")
      .toUpperCase()
      .includes("GREENHRISMAIN")
  );
  if (mainSourced.length) {
    throw new Error(
      `Refusing compare: ${mainSourced.length} cutoff_hours rows sourced from GREENHRISMAIN`
    );
  }

  const officeIds = [
    ...new Set(
      (hours ?? [])
        .map((row) => row.office_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const payeeById = new Map<
    string,
    {
      id: string;
      monthly_rate: number | null;
      per_day: number | null;
      daily_rate: number | null;
      bank_name: string | null;
      bank_account_no: string | null;
    }
  >();
  const loansByEmployee = new Map<string, Array<LoanRow & { id: string }>>();

  if (officeIds.length) {
    const { data: payees } = await publicDb
      .from("employees")
      .select(
        "id, monthly_rate, per_day, daily_rate, bank_name, bank_account_no"
      )
      .in("id", officeIds);
    for (const row of payees ?? []) {
      payeeById.set(row.id as string, row as never);
    }

    const { data: loans } = await publicDb
      .from("employee_loans")
      .select(
        "id, employee_id, loan_type, monthly_payment, cutoff_assignment, deduct_bi_monthly, is_active"
      )
      .in("employee_id", officeIds)
      .eq("is_active", true);
    for (const loan of loans ?? []) {
      const empId = loan.employee_id as string;
      const list = loansByEmployee.get(empId) ?? [];
      list.push({
        id: loan.id as string,
        loan_type: String(loan.loan_type),
        monthly_payment: Number(loan.monthly_payment) || 0,
        cutoff_assignment: String(loan.cutoff_assignment || "both"),
        deduct_bi_monthly: loan.deduct_bi_monthly as boolean | null,
      });
      loansByEmployee.set(empId, list);
    }
  }

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const lines = (hours ?? []).map((row) => {
    const officeId = row.office_employee_id as string | null;
    return buildRegisterLine({
      hoursRow: row as CutoffHoursRow,
      payee: officeId ? payeeById.get(officeId) : null,
      loans: officeId ? (loansByEmployee.get(officeId) ?? []) : [],
      periodStart,
    });
  });
  const totals = summarizeRegisterLines(lines);

  const { data: existingRun } = await publicDb
    .from("payroll_register_runs")
    .select("id, status")
    .eq("cutoff_period_id", period.id)
    .maybeSingle();

  if (existingRun?.status === "posted") {
    throw new Error(`Register already posted for ${period.period_start}`);
  }

  let runId = existingRun?.id as string | undefined;
  if (runId) {
    await publicDb.from("payroll_register_lines").delete().eq("run_id", runId);
    const { error: updError } = await publicDb
      .from("payroll_register_runs")
      .update({
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: "Sep 2026 sample-match draft (existing hours, not MAIN)",
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (updError) throw new Error(updError.message);
  } else {
    const { data: created, error: createError } = await publicDb
      .from("payroll_register_runs")
      .insert({
        cutoff_period_id: period.id,
        organization_id: period.organization_id,
        client_id: period.client_id,
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes: "Sep 2026 sample-match draft (existing hours, not MAIN)",
      })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);
    runId = created.id as string;
  }

  if (lines.length) {
    const { error: lineError } = await publicDb
      .from("payroll_register_lines")
      .insert(
        lines.map((line) => ({
          run_id: runId,
          cutoff_period_id: period.id,
          organization_id: period.organization_id,
          client_id: period.client_id,
          ...line,
        }))
      );
    if (lineError) throw new Error(lineError.message);
  }

  return { runId: runId!, line_count: lines.length, totals, lines, hours_count: hours?.length ?? 0 };
}

function loadMainDump(): LegacyPayrollSummaryRow[] {
  if (!fs.existsSync(MAIN_DUMP)) {
    throw new Error(`Missing MAIN dump: ${MAIN_DUMP}`);
  }
  const payload = JSON.parse(fs.readFileSync(MAIN_DUMP, "utf8")) as {
    rows: LegacyPayrollSummaryRow[];
  };
  return payload.rows;
}

async function main() {
  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directoryDb = publicDb.schema("directory");

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", CUTOFF_ID)
    .single();
  if (periodError) throw new Error(periodError.message);
  if (period.client_id !== ORGANIC_CLIENT_ID) {
    throw new Error(`Cutoff ${CUTOFF_ID} is not Organic house client`);
  }
  if (period.organization_id !== ORGANIC_ORG_ID) {
    throw new Error(`Cutoff ${CUTOFF_ID} is not Organic org`);
  }
  if (
    period.period_start !== PERIOD_START ||
    period.period_end !== PERIOD_END
  ) {
    throw new Error(
      `Cutoff dates ${period.period_start}…${period.period_end} != ${PERIOD_START}…${PERIOD_END}`
    );
  }

  console.log(
    `Cutoff ${CUTOFF_ID} status=${period.status} ${PERIOD_START}→${PERIOD_END}`
  );

  const register = await buildDraftRegister(publicDb, {
    id: period.id as string,
    organization_id: period.organization_id as string,
    client_id: period.client_id as string,
    period_start: period.period_start as string,
    period_end: period.period_end as string,
    payroll_date: (period.payroll_date as string | null) ?? "2026-09-20",
  });
  console.log(
    `Draft register run=${register.runId} hours=${register.hours_count} lines=${register.line_count}`,
    register.totals
  );

  const legacyRows = loadMainDump();
  console.log(`MAIN dump rows=${legacyRows.length}`);

  const dirIds = [
    ...new Set(
      register.lines
        .map((line) => line.directory_employee_id)
        .filter(Boolean) as string[]
    ),
  ];
  const legacyIdByDirectoryId = new Map<string, number>();
  if (dirIds.length) {
    const { data: people } = await directoryDb
      .from("employees")
      .select("id, legacy_id")
      .in("id", dirIds);
    for (const row of people ?? []) {
      if (row.legacy_id != null) {
        legacyIdByDirectoryId.set(row.id as string, Number(row.legacy_id));
      }
    }
  }

  const gpLines: GpRegisterLineForParity[] = register.lines.map((line) => ({
    directory_employee_id: line.directory_employee_id,
    employee_code: line.employee_code,
    last_name: line.last_name,
    first_name: line.first_name,
    gross_pay: line.gross_pay,
    net_pay: line.net_pay,
    deductions: line.deductions as Record<string, number>,
  }));

  const { rows, summary } = compareRegisterToLegacy({
    gpLines,
    legacyRows,
    legacyIdByDirectoryId,
  });

  const outDir = path.join(process.cwd(), "tmp", "sample-match");
  fs.mkdirSync(outDir, { recursive: true });

  const mismatches = rows
    .filter((r) => r.status === "mismatch")
    .map((r) => ({
      ...r,
      abs_net_delta: Math.abs(r.delta.net ?? 0),
    }))
    .sort((a, b) => b.abs_net_delta - a.abs_net_delta);

  const summaryPath = path.join(
    outDir,
    `sep-2026-09-01_2026-09-15-summary.json`
  );
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        cutoff_id: CUTOFF_ID,
        register_run_id: register.runId,
        period_start: PERIOD_START,
        period_end: PERIOD_END,
        hours_count: register.hours_count,
        summary,
        top_mismatches: mismatches.slice(0, 15).map(({ abs_net_delta: _, ...r }) => r),
      },
      null,
      2
    ),
    "utf8"
  );

  const csvPath = path.join(outDir, `sep-2026-09-01_2026-09-15.csv`);
  const header = [
    "employee_code",
    "last_name",
    "first_name",
    "legacy_id",
    "status",
    "gp_gross",
    "legacy_gross",
    "delta_gross",
    "gp_sss",
    "legacy_sss",
    "delta_sss",
    "gp_philhealth",
    "legacy_philhealth",
    "delta_philhealth",
    "gp_pagibig",
    "legacy_pagibig",
    "delta_pagibig",
    "gp_wtax",
    "legacy_wtax",
    "delta_wtax",
    "gp_loans",
    "legacy_loans",
    "delta_loans",
    "gp_net",
    "legacy_net",
    "delta_net",
  ];
  const csvRows = [header.join(",")];
  for (const r of rows) {
    csvRows.push(
      [
        r.employee_code ?? "",
        r.last_name ?? "",
        r.first_name ?? "",
        r.legacy_employee_id ?? "",
        r.status,
        r.gp.gross,
        r.legacy.gross ?? "",
        r.delta.gross ?? "",
        r.gp.sss,
        r.legacy.sss ?? "",
        r.delta.sss ?? "",
        r.gp.philhealth,
        r.legacy.philhealth ?? "",
        r.delta.philhealth ?? "",
        r.gp.pagibig,
        r.legacy.pagibig ?? "",
        r.delta.pagibig ?? "",
        r.gp.wtax,
        r.legacy.wtax ?? "",
        r.delta.wtax ?? "",
        r.gp.loans,
        r.legacy.loans ?? "",
        r.delta.loans ?? "",
        r.gp.net,
        r.legacy.net ?? "",
        r.delta.net ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");

  console.log("\nParity summary", summary);
  console.log(`Wrote ${summaryPath}`);
  console.log(`Wrote ${csvPath} (${rows.length} rows)`);
  console.log("\nTotals Δ (GP − MAIN):");
  console.log({
    gross: round2(summary.gp_totals.gross - summary.legacy_totals.gross),
    net: round2(summary.gp_totals.net - summary.legacy_totals.net),
    sss: round2(summary.gp_totals.sss - summary.legacy_totals.sss),
    philhealth: round2(
      summary.gp_totals.philhealth - summary.legacy_totals.philhealth
    ),
    pagibig: round2(summary.gp_totals.pagibig - summary.legacy_totals.pagibig),
    wtax: round2(summary.gp_totals.wtax - summary.legacy_totals.wtax),
    loans: round2(summary.gp_totals.loans - summary.legacy_totals.loans),
  });
  if (mismatches.length) {
    console.log("\nTop net mismatches:");
    for (const m of mismatches.slice(0, 8)) {
      console.log(
        `  ${m.last_name}, ${m.first_name}  grossΔ=${m.delta.gross} wtaxΔ=${m.delta.wtax} loansΔ=${m.delta.loans} netΔ=${m.delta.net}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
