/**
 * Build a draft payroll register from approved cutoff_hours (live GP compute).
 * Does not post. Service-role script for dual-run / ops.
 *
 *   npx tsx scripts/build-cutoff-register-draft.ts --cutoff-id <uuid>
 *   npx tsx scripts/build-cutoff-register-draft.ts --cutoff-id <uuid> --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  buildRegisterLine,
  summarizeRegisterLines,
  type CutoffHoursRow,
} from "../lib/payroll-register/compute";
import { statutoryThisCutoff } from "../lib/ph-payroll/statutory-schedule";
import type { LoanRow } from "../lib/ph-payroll/compute-cutoff-payslip";
import { stampEmployeeCodesOntoHours } from "../lib/timekeeping/stamp-employee-codes";
import type { CutoffHoursIngestRow } from "../lib/timekeeping/cutoff-types";
import { organicRegisterLineToAuditRow } from "../lib/payroll-register/organic-register-to-audit-row";
import { loadMainAccrualScrapeForCutoff } from "../lib/payroll-register/load-main-accrual-scrape";
import {
  laterCutoffBasicsForName,
  matchScrapedAccrual,
} from "../lib/payroll-register/main-accrual-overlay";

const APPLY = process.argv.includes("--apply");

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!.trim();
  return undefined;
}

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
  const cutoffId = argValue("--cutoff-id");
  if (!cutoffId) throw new Error("Pass --cutoff-id <uuid>");

  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = publicDb.schema("directory") as unknown as SupabaseClient;

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", cutoffId)
    .maybeSingle();
  if (periodError) throw periodError;
  if (!period) throw new Error("Cutoff not found");
  if (period.status !== "approved" && period.status !== "posted") {
    throw new Error(`Cutoff status is ${period.status}; need approved`);
  }
  if (period.source_app === "greenhrismain-catalog") {
    throw new Error("Refusing to rebuild a MAIN catalog cutoff with GP compute");
  }

  const { data: existingRun } = await publicDb
    .from("payroll_register_runs")
    .select("id, status, notes")
    .eq("cutoff_period_id", cutoffId)
    .maybeSingle();
  if (existingRun?.status === "posted") {
    throw new Error("Register already posted — leave it alone");
  }

  const { data: hours, error: hoursError } = await publicDb
    .from("cutoff_hours")
    .select("*")
    .eq("cutoff_period_id", cutoffId)
    .order("last_name");
  if (hoursError) throw hoursError;
  if (!hours?.length) throw new Error("No cutoff_hours rows");

  const dirIds = [
    ...new Set(
      hours
        .map((row) => row.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const officeIds = [
    ...new Set(
      hours
        .map((row) => row.office_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const { data: clientRow } = await directory
    .from("clients")
    .select(
      "name, cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency, statutory_schedule, wtax_schedule, include_cola, include_sea, include_ctpa"
    )
    .eq("id", period.client_id)
    .maybeSingle();

  const supplementalPolicy = {
    include_cola: Boolean(clientRow?.include_cola),
    include_sea: Boolean(clientRow?.include_sea),
    include_ctpa: Boolean(clientRow?.include_ctpa),
  };
  const statutoryFlags = statutoryThisCutoff(
    clientRow ?? {},
    String(period.period_start)
  );

  const dirPayeeById = new Map<
    string,
    {
      daily_rate: number | null;
      bank_name: string | null;
      bank_account_no: string | null;
      ecola: number | null;
      position_id: string | null;
      employee_code: string | null;
      last_name: string | null;
      first_name: string | null;
    }
  >();
  if (dirIds.length) {
    const { data: dirEmps } = await directory
      .from("employees")
      .select(
        "id, daily_rate, bank_name, bank_account_no, ecola, position_id, employee_code, last_name, first_name"
      )
      .in("id", dirIds);
    for (const row of dirEmps ?? []) {
      dirPayeeById.set(row.id as string, {
        daily_rate: (row.daily_rate as number | null) ?? null,
        bank_name: (row.bank_name as string | null) ?? null,
        bank_account_no: (row.bank_account_no as string | null) ?? null,
        ecola: (row.ecola as number | null) ?? null,
        position_id: (row.position_id as string | null) ?? null,
        employee_code: (row.employee_code as string | null) ?? null,
        last_name: (row.last_name as string | null) ?? null,
        first_name: (row.first_name as string | null) ?? null,
      });
    }
  }

  const positionIds = [
    ...new Set(
      [...dirPayeeById.values()]
        .map((row) => row.position_id)
        .filter(Boolean) as string[]
    ),
  ];
  const positionById = new Map<
    string,
    { ecola: number | null; sea: number | null; ctpa: number | null }
  >();
  if (positionIds.length) {
    const { data: positions } = await directory
      .from("positions")
      .select("id, ecola, sea, ctpa")
      .in("id", positionIds);
    for (const row of positions ?? []) {
      positionById.set(row.id as string, {
        ecola: (row.ecola as number | null) ?? null,
        sea: (row.sea as number | null) ?? null,
        ctpa: (row.ctpa as number | null) ?? null,
      });
    }
  }

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
  }

  let loanQuery = publicDb
    .from("employee_loans")
    .select(
      "id, employee_id, directory_employee_id, loan_type, particular, monthly_payment, cutoff_assignment, deduct_bi_monthly, is_active, effectivity_date, current_balance"
    )
    .eq("is_active", true)
    .gt("current_balance", 0);
  if (officeIds.length && dirIds.length) {
    loanQuery = loanQuery.or(
      `employee_id.in.(${officeIds.join(",")}),directory_employee_id.in.(${dirIds.join(",")})`
    );
  } else if (officeIds.length) {
    loanQuery = loanQuery.in("employee_id", officeIds);
  } else if (dirIds.length) {
    loanQuery = loanQuery.in("directory_employee_id", dirIds);
  }
  const loanRows =
    officeIds.length || dirIds.length ? ((await loanQuery).data ?? []) : [];

  const scheduleByLoan = new Map<string, { id: string; amount: number }>();
  if (loanRows.length) {
    const { data: schedules } = await publicDb
      .from("employee_loan_schedules")
      .select("id, loan_id, amount, status")
      .in(
        "loan_id",
        loanRows.map((row) => row.id as string)
      )
      .eq("status", "pending")
      .eq("period_start", period.period_start);
    for (const row of schedules ?? []) {
      scheduleByLoan.set(row.loan_id as string, {
        id: row.id as string,
        amount: Number(row.amount) || 0,
      });
    }
  }

  const loansByEmployee = new Map<string, Array<LoanRow & { id: string }>>();
  const loansByDirectory = new Map<string, Array<LoanRow & { id: string }>>();
  const pushLoan = (
    map: Map<string, Array<LoanRow & { id: string }>>,
    key: string | null,
    loan: LoanRow & { id: string }
  ) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    if (list.some((row) => row.id === loan.id)) return;
    list.push(loan);
    map.set(key, list);
  };
  for (const loan of loanRows) {
    const scheduled = scheduleByLoan.get(loan.id as string);
    const mapped: LoanRow & { id: string } = {
      id: loan.id as string,
      loan_type: String(loan.loan_type),
      particular: (loan.particular as string | null) ?? null,
      monthly_payment: Number(loan.monthly_payment) || 0,
      cutoff_assignment: String(loan.cutoff_assignment || "both"),
      deduct_bi_monthly: loan.deduct_bi_monthly as boolean | null,
      current_balance: Number(loan.current_balance) || 0,
      effectivity_date: (loan.effectivity_date as string | null) ?? null,
      scheduled_amount: scheduled?.amount ?? null,
      schedule_id: scheduled?.id ?? null,
    };
    pushLoan(loansByEmployee, loan.employee_id as string | null, mapped);
    pushLoan(
      loansByDirectory,
      loan.directory_employee_id as string | null,
      mapped
    );
  }

  const stampedHours = stampEmployeeCodesOntoHours(
    hours as CutoffHoursIngestRow[],
    new Map(
      [...dirPayeeById.entries()].map(([id, row]) => [
        id,
        {
          employee_code: row.employee_code,
          last_name: row.last_name,
          first_name: row.first_name,
        },
      ])
    )
  );

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const lines = stampedHours.map((row) => {
    const dirId = row.directory_employee_id as string | null;
    const officeId = row.office_employee_id as string | null;
    const dirPayee = dirId ? dirPayeeById.get(dirId) : null;
    const position = dirPayee?.position_id
      ? positionById.get(dirPayee.position_id)
      : null;
    const officePayee = officeId ? payeeById.get(officeId) : null;
    const loans = new Map<string, LoanRow & { id: string }>();
    for (const loan of officeId ? loansByEmployee.get(officeId) ?? [] : []) {
      loans.set(loan.id, loan);
    }
    for (const loan of dirId ? loansByDirectory.get(dirId) ?? [] : []) {
      loans.set(loan.id, loan);
    }
    return buildRegisterLine({
      hoursRow: {
        ...(row as CutoffHoursRow),
        daily_rate_payroll:
          Number(row.daily_rate_payroll) ||
          Number(dirPayee?.daily_rate) ||
          Number(officePayee?.daily_rate) ||
          0,
      },
      payee: officePayee
        ? officePayee
        : dirPayee
          ? {
              id: dirId!,
              daily_rate: dirPayee.daily_rate,
              bank_name: dirPayee.bank_name,
              bank_account_no: dirPayee.bank_account_no,
            }
          : null,
      loans: [...loans.values()],
      periodStart,
      statutory: statutoryFlags,
      supplementalPolicy,
      supplementalRates: {
        ecola: Number(position?.ecola ?? dirPayee?.ecola) || 0,
        sea: Number(position?.sea) || 0,
        ctpa: Number(position?.ctpa) || 0,
      },
    });
  });
  const totals = summarizeRegisterLines(lines);

  console.log(
    `${APPLY ? "APPLY" : "Dry-run"} draft register · ${period.period_start}…${period.period_end}`
  );
  console.log(
    `client=${clientRow?.name ?? period.client_id} hours=${hours.length} lines=${lines.length}`
  );
  console.log("totals", totals);

  const claire = lines.find(
    (line) =>
      (line.last_name ?? "").toLowerCase() === "aban" &&
      (line.first_name ?? "").toLowerCase().startsWith("claire")
  );
  if (claire) {
    const pack = await loadMainAccrualScrapeForCutoff(publicDb, directory, {
      clientId: period.client_id,
      branchId: period.branch_id,
      periodEnd: String(period.period_end),
    });
    const scraped = pack.mainScrape
      ? matchScrapedAccrual(
          `${claire.last_name}, ${claire.first_name}`,
          pack.mainScrape.employees
        )
      : null;
    const audit = organicRegisterLineToAuditRow(claire, {
      registerPeriodEnd: String(period.period_end),
      scrapePeriodEnd: pack.mainScrape?.periodEnd,
      scraped,
      laterCutoffBasics: laterCutoffBasicsForName(
        `${claire.last_name}, ${claire.first_name}`,
        pack.laterPostedBasics
      ),
    });
    console.log("Claire GP draft + overlay", {
      gross: claire.gross_pay,
      net: claire.net_pay,
      basic: claire.earnings.basic,
      loans: claire.deductions.loans,
      thirteenthMonthCutoff: audit.thirteenthMonthCutoff,
      thirteenthMonthYTD: audit.thirteenthMonthYTD,
      silCutoff: audit.silCutoff,
      scrapeEnd: pack.mainScrape?.periodEnd ?? null,
    });
  }

  if (!APPLY) {
    console.log("Dry-run complete. Pass --apply to write draft run/lines.");
    return;
  }

  let runId = existingRun?.id as string | undefined;
  const notes = `GP live draft from cutoff_hours (${new Date().toISOString().slice(0, 10)})`;
  if (runId) {
    await publicDb.from("payroll_register_lines").delete().eq("run_id", runId);
    const { error } = await publicDb
      .from("payroll_register_runs")
      .update({
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (error) throw error;
  } else {
    const { data, error } = await publicDb
      .from("payroll_register_runs")
      .insert({
        cutoff_period_id: cutoffId,
        organization_id: period.organization_id,
        client_id: period.client_id,
        status: "draft",
        period_start: period.period_start,
        period_end: period.period_end,
        payroll_date: period.payroll_date,
        line_count: lines.length,
        totals,
        notes,
      })
      .select("id")
      .single();
    if (error) throw error;
    runId = data.id as string;
  }

  if (lines.length) {
    const { error } = await publicDb.from("payroll_register_lines").insert(
      lines.map((line) => ({
        run_id: runId,
        cutoff_period_id: cutoffId,
        organization_id: period.organization_id,
        client_id: period.client_id,
        directory_employee_id: line.directory_employee_id,
        office_employee_id: line.office_employee_id,
        employee_code: line.employee_code,
        last_name: line.last_name,
        first_name: line.first_name,
        daily_rate: line.daily_rate,
        monthly_salary: line.monthly_salary,
        hours: line.hours,
        earnings: line.earnings,
        deductions: line.deductions,
        loan_lines: line.loan_lines,
        gross_pay: line.gross_pay,
        total_deductions: line.total_deductions,
        net_pay: line.net_pay,
        bank_name: line.bank_name,
        bank_account_no: line.bank_account_no,
      }))
    );
    if (error) throw error;
  }
  console.log(`Wrote draft run ${runId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
