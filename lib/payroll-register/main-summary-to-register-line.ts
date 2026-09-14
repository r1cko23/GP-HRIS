/**
 * Map GREENHRISMAIN payroll_summary row(s) → GP register line JSON.
 * Catalog mirror of MAIN pesos — not GP compute (ADR 0009).
 */

import { mapParticularToLoanType } from "../loans/particular";
import {
  summarizeRegisterLines,
  type BuiltRegisterLine,
} from "./compute";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase()
    );
    if (found && row[found] != null && row[found] !== "") return row[found];
  }
  return null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function sumField(rows: Record<string, unknown>[], ...keys: string[]): number {
  return round2(rows.reduce((acc, row) => acc + n(pick(row, ...keys)), 0));
}

function maxField(rows: Record<string, unknown>[], ...keys: string[]): number {
  let max = 0;
  for (const row of rows) {
    const v = n(pick(row, ...keys));
    if (v > max) max = v;
  }
  return round2(max);
}

function firstText(
  rows: Record<string, unknown>[],
  ...keys: string[]
): string | null {
  for (const row of rows) {
    const v = text(pick(row, ...keys));
    if (v) return v;
  }
  return null;
}

export const MAIN_CATALOG_SOURCE_APP = "greenhrismain-catalog";
export const MAIN_CATALOG_NOTES_PREFIX = "MAIN catalog import";

export type MainOtherDeductionRow = {
  particular?: unknown;
  amount?: unknown;
  idloan?: unknown;
  idloanschedule?: unknown;
  idpayrollsum?: unknown;
  employee_id?: unknown;
};

/**
 * MAIN tags loans on `otherdeduction` (idloan / idloanschedule / loan particular),
 * not on payroll_summary.Other_Deduction.
 */
export function isMainLoanOtherDeduction(row: MainOtherDeductionRow): boolean {
  if (n(row.idloan) > 0 || n(row.idloanschedule) > 0) return true;
  const key = String(row.particular ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return false;
  if (
    key.includes("cash advance") ||
    key.includes("vale") ||
    key.includes("uniform") ||
    key.includes("nameplate")
  ) {
    return false;
  }
  if (key.includes("loan")) return true;
  return mapParticularToLoanType(key) !== "other";
}

function catalogLoanType(particular: string): string {
  const type = mapParticularToLoanType(particular);
  if (type !== "other") return type;
  if (/loan/i.test(particular)) return "company";
  return type;
}

function loanLinesFromOtherDeductions(
  rows: MainOtherDeductionRow[]
): BuiltRegisterLine["loan_lines"] {
  const byKey = new Map<string, BuiltRegisterLine["loan_lines"][number]>();
  for (const row of rows) {
    if (!isMainLoanOtherDeduction(row)) continue;
    const particular = text(row.particular) ?? "Loan";
    const key = particular.toLowerCase();
    const amount = n(row.amount);
    const existing = byKey.get(key);
    if (existing) {
      existing.amount = round2(existing.amount + amount);
      continue;
    }
    const scheduleId =
      n(row.idloanschedule) > 0 ? String(Math.trunc(n(row.idloanschedule))) : null;
    const loanId =
      n(row.idloan) > 0
        ? `main-catalog-${Math.trunc(n(row.idloan))}`
        : `main-catalog-${key.replace(/[^a-z0-9]+/g, "-")}`;
    byKey.set(key, {
      loan_id: loanId,
      loan_type: catalogLoanType(particular),
      particular,
      amount: round2(amount),
      schedule_id: scheduleId,
    });
  }
  return [...byKey.values()];
}

function summaryLoanLines(
  salaryLoan: number,
  pagibigLoan: number,
  sssLoan: number
): BuiltRegisterLine["loan_lines"] {
  const loan_lines: BuiltRegisterLine["loan_lines"] = [];
  if (salaryLoan > 0) {
    loan_lines.push({
      loan_id: "main-catalog-salary",
      loan_type: "company",
      particular: "Salary Loan",
      amount: salaryLoan,
      schedule_id: null,
    });
  }
  if (pagibigLoan > 0) {
    loan_lines.push({
      loan_id: "main-catalog-pagibig",
      loan_type: "pagibig",
      particular: "Pag-Ibig Loan",
      amount: pagibigLoan,
      schedule_id: null,
    });
  }
  if (sssLoan > 0) {
    loan_lines.push({
      loan_id: "main-catalog-sss",
      loan_type: "sss",
      particular: "SSS Loan",
      amount: sssLoan,
      schedule_id: null,
    });
  }
  return loan_lines;
}

/** Run.totals the cutoff summary card reads — same keys as a live register build. */
export function mainCatalogRunTotals(lines: BuiltRegisterLine[]) {
  return {
    ...summarizeRegisterLines(lines),
    source: MAIN_CATALOG_SOURCE_APP,
  };
}

export function mainSummaryRowsToRegisterLine(input: {
  directoryEmployeeId: string;
  officeEmployeeId?: string | null;
  employeeCode?: string | null;
  rows: Record<string, unknown>[];
  otherDeductions?: MainOtherDeductionRow[];
}): BuiltRegisterLine {
  const rows = input.rows;
  if (!rows.length) {
    throw new Error("mainSummaryRowsToRegisterLine requires at least one row");
  }

  const salaryLoan = sumField(rows, "Salary_Loan", "salary_loan");
  const pagibigLoan = sumField(rows, "Pagibig_Loan", "pagibig_loan");
  const sssLoan = sumField(rows, "SSS_Loan", "sss_loan");
  const childRows = input.otherDeductions ?? [];
  const taggedLoans = childRows.filter(isMainLoanOtherDeduction);
  const leftover = childRows.filter((row) => !isMainLoanOtherDeduction(row));

  let loans: number;
  let other: number;
  let loan_lines: BuiltRegisterLine["loan_lines"];
  if (childRows.length > 0) {
    loans = round2(taggedLoans.reduce((acc, row) => acc + n(row.amount), 0));
    other = round2(leftover.reduce((acc, row) => acc + n(row.amount), 0));
    loan_lines = loanLinesFromOtherDeductions(taggedLoans);
  } else {
    loans = round2(salaryLoan + pagibigLoan + sssLoan);
    other = sumField(rows, "Other_Deduction", "other_deduction");
    loan_lines = summaryLoanLines(salaryLoan, pagibigLoan, sssLoan);
  }

  const daily = n(pick(rows[0]!, "dailyrate_payroll"));
  const days = sumField(rows, "noofdayswork", "Regular_Days", "regular_days", "days");

  return {
    directory_employee_id: input.directoryEmployeeId,
    office_employee_id: input.officeEmployeeId ?? null,
    employee_code: input.employeeCode ?? null,
    last_name: firstText(rows, "last_name", "lname"),
    first_name: firstText(rows, "first_name", "fname"),
    daily_rate: daily,
    monthly_salary: daily > 0 ? round2(daily * 26) : 0,
    hours: {
      actual_regular_hours: sumField(
        rows,
        "actualregularhours",
        "actual_regular_hours",
        "noofhourswork"
      ),
      hours_work: sumField(
        rows,
        "noofhourswork",
        "hours_work",
        "actualregularhours"
      ),
      overtime_hours: sumField(rows, "Overtime_Hours", "overtime_hours"),
      night_diff_hours: sumField(rows, "Nightdiff_Hours", "night_diff_hours"),
      regular_night_ot_hours: sumField(
        rows,
        "regularnightshiftOT_hours",
        "regular_night_ot_hours"
      ),
      legal_holiday_hours: sumField(
        rows,
        "LegalHoliday_Hours",
        "legal_holiday_hours"
      ),
      legal_holiday_ot_hours: sumField(
        rows,
        "LegalHoliday_OT_Hours",
        "legal_holiday_ot_hours"
      ),
      special_holiday_hours: sumField(
        rows,
        "Holiday_Special_Hours",
        "special_holiday_hours"
      ),
      special_holiday_ot_hours: sumField(
        rows,
        "Holiday_Special_OT_Hours",
        "special_holiday_ot_hours"
      ),
      rest_day_hours: sumField(rows, "rdhours", "RDhours", "rest_day_hours"),
      rest_day_ot_hours: sumField(rows, "RDothours", "rest_day_ot_hours"),
      wdo_hours: sumField(rows, "WDOhours", "wdo_hours"),
      tardiness_hours: sumField(rows, "tardiness", "tardiness_hours"),
      undertime_hours: sumField(rows, "undertime", "undertime_hours"),
      absences_hours: sumField(rows, "absences", "absences_hours"),
      pto_hours: sumField(rows, "pto", "pto_hours"),
      days_work: days,
    },
    earnings: {
      basic: sumField(rows, "basic"),
      overtime: sumField(rows, "Overtime", "overtime", "TotalOT"),
      night_diff: sumField(rows, "Nightdiff", "night_diff"),
      legal_holiday: sumField(rows, "LegalHoliday", "legal_holiday"),
      special_holiday: sumField(rows, "Holiday_Special", "special_holiday"),
      rest_day: sumField(rows, "RD", "rest_day"),
      wdo: sumField(rows, "WDO", "wdo"),
      allowance: sumField(rows, "allowancep", "allowance"),
      adjustment: sumField(rows, "Adjustment", "Adjustment2", "incomeadjustmentp"),
      thirteenth_month: sumField(rows, "thirteenmonth"),
      thirteenth_month_ytd: maxField(rows, "ytdthirteenmonth"),
      sil_cutoff: sumField(rows, "silp", "sil_cutoff"),
      days_work: days,
    },
    deductions: {
      sss: sumField(rows, "contributionSSSEE"),
      sss_wisp: sumField(rows, "contributionSSSEEpro"),
      sss_er: sumField(rows, "contributionSSSER"),
      sss_wisp_er: sumField(rows, "contributionSSSERpro"),
      sss_ecc: sumField(rows, "contributionSSSECC"),
      philhealth: sumField(rows, "contributionphilhealthEE"),
      philhealth_er: sumField(rows, "contributionphilhealthER"),
      pagibig: sumField(rows, "contributionPagibigEE"),
      pagibig_er: sumField(rows, "contributionPagibigER"),
      withholding_tax: sumField(rows, "Wtax", "wtax"),
      loans,
      other,
    },
    loan_lines,
    gross_pay: sumField(rows, "grossalary", "gross_pay"),
    total_deductions: sumField(rows, "Totaldeduction", "total_deductions"),
    net_pay: sumField(rows, "netamount", "net_pay"),
    bank_name: firstText(rows, "empbankname", "bank_name", "bankname"),
    bank_account_no: firstText(
      rows,
      "payrollatmno",
      "bank_account_no",
      "bankaccountno"
    ),
  };
}
