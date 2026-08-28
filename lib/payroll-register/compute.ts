/**
 * Build Organic payroll register lines from approved cutoff_hours.
 * Formulas reuse GP-HRIS statutory helpers (GREENHRISMAIN-parity starting point).
 */

import {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "@/lib/ph-payroll/statutory-cutoff";
import {
  sumLoansForCutoff,
  type LoanRow,
} from "@/lib/ph-payroll/compute-cutoff-payslip";
import { calculateMonthlySalary } from "@/utils/ph-deductions";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Premium multipliers (PH DOLE-style; documented for Organic register). */
export const PREMIUM_RATES = {
  regular: 1,
  overtime: 1.25,
  night_diff: 0.1,
  regular_night_ot: 1.375,
  legal_holiday: 2,
  legal_holiday_ot: 2.6,
  legal_holiday_nd: 0.2,
  special_holiday: 1.3,
  special_holiday_ot: 1.69,
  rest_day: 1.3,
  rest_day_ot: 1.69,
  wdo: 1.3,
  pto: 1,
} as const;

export type CutoffHoursRow = {
  id: string;
  directory_employee_id: string | null;
  office_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  daily_rate_payroll: number | string | null;
  actual_regular_hours?: number | string | null;
  hours_work?: number | string | null;
  overtime_hours?: number | string | null;
  night_diff_hours?: number | string | null;
  regular_night_ot_hours?: number | string | null;
  legal_holiday_hours?: number | string | null;
  legal_holiday_ot_hours?: number | string | null;
  legal_holiday_nd_hours?: number | string | null;
  special_holiday_hours?: number | string | null;
  special_holiday_ot_hours?: number | string | null;
  rest_day_hours?: number | string | null;
  rest_day_ot_hours?: number | string | null;
  wdo_hours?: number | string | null;
  pto_hours?: number | string | null;
  allowance?: number | string | null;
  tardiness_hours?: number | string | null;
  undertime_hours?: number | string | null;
  absences_hours?: number | string | null;
};

export type OfficePayee = {
  id: string;
  monthly_rate?: number | null;
  per_day?: number | null;
  daily_rate?: number | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_account_no?: string | null;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function hourlyFromDaily(dailyRate: number): number {
  return dailyRate > 0 ? dailyRate / 8 : 0;
}

export function computeEarningsFromHours(
  row: CutoffHoursRow,
  dailyRate: number
): { earnings: Record<string, number>; gross: number; hours: Record<string, number> } {
  const hourly = hourlyFromDaily(dailyRate);
  const hours = {
    actual_regular_hours: n(row.actual_regular_hours),
    overtime_hours: n(row.overtime_hours),
    night_diff_hours: n(row.night_diff_hours),
    regular_night_ot_hours: n(row.regular_night_ot_hours),
    legal_holiday_hours: n(row.legal_holiday_hours),
    legal_holiday_ot_hours: n(row.legal_holiday_ot_hours),
    legal_holiday_nd_hours: n(row.legal_holiday_nd_hours),
    special_holiday_hours: n(row.special_holiday_hours),
    special_holiday_ot_hours: n(row.special_holiday_ot_hours),
    rest_day_hours: n(row.rest_day_hours),
    rest_day_ot_hours: n(row.rest_day_ot_hours),
    wdo_hours: n(row.wdo_hours),
    pto_hours: n(row.pto_hours),
    tardiness_hours: n(row.tardiness_hours),
    undertime_hours: n(row.undertime_hours),
    absences_hours: n(row.absences_hours),
    hours_work: n(row.hours_work),
  };

  const earnings: Record<string, number> = {
    basic: round2(hours.actual_regular_hours * hourly * PREMIUM_RATES.regular),
    overtime: round2(hours.overtime_hours * hourly * PREMIUM_RATES.overtime),
    night_diff: round2(hours.night_diff_hours * hourly * PREMIUM_RATES.night_diff),
    regular_night_ot: round2(
      hours.regular_night_ot_hours * hourly * PREMIUM_RATES.regular_night_ot
    ),
    legal_holiday: round2(
      hours.legal_holiday_hours * hourly * PREMIUM_RATES.legal_holiday
    ),
    legal_holiday_ot: round2(
      hours.legal_holiday_ot_hours * hourly * PREMIUM_RATES.legal_holiday_ot
    ),
    legal_holiday_nd: round2(
      hours.legal_holiday_nd_hours * hourly * PREMIUM_RATES.legal_holiday_nd
    ),
    special_holiday: round2(
      hours.special_holiday_hours * hourly * PREMIUM_RATES.special_holiday
    ),
    special_holiday_ot: round2(
      hours.special_holiday_ot_hours * hourly * PREMIUM_RATES.special_holiday_ot
    ),
    rest_day: round2(hours.rest_day_hours * hourly * PREMIUM_RATES.rest_day),
    rest_day_ot: round2(
      hours.rest_day_ot_hours * hourly * PREMIUM_RATES.rest_day_ot
    ),
    wdo: round2(hours.wdo_hours * hourly * PREMIUM_RATES.wdo),
    pto: round2(hours.pto_hours * hourly * PREMIUM_RATES.pto),
    allowance: round2(n(row.allowance)),
  };

  const tardinessDeduct = round2(
    (hours.tardiness_hours + hours.undertime_hours + hours.absences_hours) *
      hourly
  );
  earnings.tardiness_undertime_absence = -tardinessDeduct;

  const gross = round2(
    Object.values(earnings).reduce((acc, v) => acc + v, 0)
  );

  return { earnings, gross: Math.max(0, gross), hours };
}

export type BuiltRegisterLine = {
  directory_employee_id: string | null;
  office_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  daily_rate: number;
  monthly_salary: number;
  hours: Record<string, number>;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  loan_lines: Array<{
    loan_id: string;
    loan_type: string;
    amount: number;
  }>;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  bank_name: string | null;
  bank_account_no: string | null;
};

export function buildRegisterLine(input: {
  hoursRow: CutoffHoursRow;
  payee?: OfficePayee | null;
  loans: Array<LoanRow & { id: string }>;
  periodStart: Date;
  otherDeductions?: number;
}): BuiltRegisterLine {
  const dailyRate =
    n(input.hoursRow.daily_rate_payroll) ||
    n(input.payee?.daily_rate) ||
    n(input.payee?.per_day) ||
    0;
  const monthlySalary =
    n(input.payee?.monthly_rate) ||
    (dailyRate > 0 ? calculateMonthlySalary(dailyRate, 26) : 0);

  const { earnings, gross, hours } = computeEarningsFromHours(
    input.hoursRow,
    dailyRate
  );

  const firstCutoff = input.periodStart.getUTCDate() <= 15;
  const loanTotals = sumLoansForCutoff(input.loans, firstCutoff);
  const loan_lines = input.loans
    .map((loan) => {
      const assignment = loan.cutoff_assignment || "both";
      const cutoffKey = firstCutoff ? "first" : "second";
      if (assignment !== "both" && assignment !== cutoffKey) return null;
      const payment = Number(loan.monthly_payment) || 0;
      if (payment <= 0) return null;
      const deductBiMonthly = loan.deduct_bi_monthly !== false;
      const amount = round2(deductBiMonthly ? payment / 2 : payment);
      return {
        loan_id: loan.id,
        loan_type: loan.loan_type,
        amount,
      };
    })
    .filter(Boolean) as Array<{
    loan_id: string;
    loan_type: string;
    amount: number;
  }>;

  const statutory = getCutoffStatutoryDeductions(monthlySalary);
  const tax = computeCutoffWithholdingTax(gross, monthlySalary);
  const other = round2(input.otherDeductions ?? 0);

  const deductions = {
    sss: statutory.sss,
    philhealth: statutory.philhealth,
    pagibig: statutory.pagibig,
    withholding_tax: tax.tax,
    loans: loanTotals.total,
    other,
  };

  const total_deductions = round2(
    deductions.sss +
      deductions.philhealth +
      deductions.pagibig +
      deductions.withholding_tax +
      deductions.loans +
      deductions.other
  );

  return {
    directory_employee_id: input.hoursRow.directory_employee_id,
    office_employee_id: input.hoursRow.office_employee_id,
    employee_code: input.hoursRow.employee_code,
    last_name: input.hoursRow.last_name,
    first_name: input.hoursRow.first_name,
    daily_rate: dailyRate,
    monthly_salary: monthlySalary,
    hours,
    earnings,
    deductions,
    loan_lines,
    gross_pay: gross,
    total_deductions,
    net_pay: round2(Math.max(0, gross - total_deductions)),
    bank_name: input.payee?.bank_name ?? null,
    bank_account_no:
      input.payee?.bank_account_no ?? input.payee?.bank_account ?? null,
  };
}

export function summarizeRegisterLines(lines: BuiltRegisterLine[]) {
  return {
    line_count: lines.length,
    gross_pay: round2(lines.reduce((a, l) => a + l.gross_pay, 0)),
    total_deductions: round2(
      lines.reduce((a, l) => a + l.total_deductions, 0)
    ),
    net_pay: round2(lines.reduce((a, l) => a + l.net_pay, 0)),
    sss: round2(lines.reduce((a, l) => a + (l.deductions.sss ?? 0), 0)),
    philhealth: round2(
      lines.reduce((a, l) => a + (l.deductions.philhealth ?? 0), 0)
    ),
    pagibig: round2(lines.reduce((a, l) => a + (l.deductions.pagibig ?? 0), 0)),
    withholding_tax: round2(
      lines.reduce((a, l) => a + (l.deductions.withholding_tax ?? 0), 0)
    ),
    loans: round2(lines.reduce((a, l) => a + (l.deductions.loans ?? 0), 0)),
  };
}
