/**
 * Build Organic payroll register lines from approved cutoff_hours.
 */

import {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "@/lib/ph-payroll/statutory-cutoff";
import {
  sumLoansForCutoff,
  type LoanRow,
} from "@/lib/ph-payroll/compute-cutoff-payslip";
import { deductionForCutoff } from "@/lib/loans/deduct";
import { particularLabel } from "@/lib/loans/particular";
import { calculateMonthlySalary } from "@/lib/ph-payroll/contributions";
import {
  computeEarningsFromHours,
  type CutoffHoursRow,
} from "@/lib/ph-payroll/premiums";
import {
  computeSupplementalPayroll,
  payrollDaysFromHours,
  resolveSupplementalRates,
  supplementalToEarnings,
  type ClientSupplementalPolicy,
  type SupplementalRateSource,
} from "@/lib/ph-payroll/supplemental-pay";

export { PREMIUM_RATES, computeEarningsFromHours } from "@/lib/ph-payroll/premiums";
export type { CutoffHoursRow } from "@/lib/ph-payroll/premiums";

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    particular: string;
    amount: number;
    schedule_id: string | null;
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
  /** Next-cutoff catch-up (ADR 0012). Signed peso; not used for statutory recompute in v1. */
  adjustmentAmount?: number;
  statutory?: {
    sss: boolean;
    philhealth: boolean;
    pagibig: boolean;
    wtax: boolean;
  };
  supplementalPolicy?: ClientSupplementalPolicy;
  supplementalRates?: SupplementalRateSource;
}): BuiltRegisterLine {
  const dailyRate =
    n(input.hoursRow.daily_rate_payroll) ||
    n(input.payee?.daily_rate) ||
    n(input.payee?.per_day) ||
    0;
  const monthlySalary =
    n(input.payee?.monthly_rate) ||
    (dailyRate > 0 ? calculateMonthlySalary(dailyRate, 26) : 0);

  const { earnings: hourEarnings, gross, hours } = computeEarningsFromHours(
    input.hoursRow,
    dailyRate
  );

  const policy = input.supplementalPolicy ?? {
    include_cola: false,
    include_sea: false,
    include_ctpa: false,
  };
  const supplemental = computeSupplementalPayroll({
    policy,
    rates: resolveSupplementalRates(input.supplementalRates ?? {}),
    daysWork: payrollDaysFromHours(hours),
  });
  const adjustment = round2(n(input.adjustmentAmount));
  const earnings = {
    ...hourEarnings,
    ...supplementalToEarnings(supplemental),
    ...(adjustment !== 0 ? { adjustment } : {}),
  };

  const loanTotals = sumLoansForCutoff(input.loans, input.periodStart);
  const loan_lines = input.loans
    .map((loan) => {
      const scheduled =
        loan.scheduled_amount != null
          ? {
              id: loan.schedule_id ?? loan.id,
              amount: Number(loan.scheduled_amount),
            }
          : null;
      const { amount, schedule_id } = deductionForCutoff({
        loan,
        periodStart: input.periodStart,
        scheduled,
      });
      if (amount <= 0) return null;
      return {
        loan_id: loan.id,
        loan_type: loan.loan_type,
        particular: particularLabel(loan.loan_type, loan.particular),
        amount,
        schedule_id,
      };
    })
    .filter(Boolean) as Array<{
    loan_id: string;
    loan_type: string;
    particular: string;
    amount: number;
    schedule_id: string | null;
  }>;

  const statutory = getCutoffStatutoryDeductions(monthlySalary);
  const applyStat = input.statutory ?? {
    sss: true,
    philhealth: true,
    pagibig: true,
    wtax: true,
  };
  const eeTaken = round2(
    (applyStat.sss ? statutory.sss : 0) +
      (applyStat.philhealth ? statutory.philhealth : 0) +
      (applyStat.pagibig ? statutory.pagibig : 0)
  );
  const tax = applyStat.wtax
    ? computeCutoffWithholdingTax(gross, monthlySalary, undefined, eeTaken)
    : { tax: 0, taxableIncome: gross, cutoffContributions: 0 };
  const other = round2(input.otherDeductions ?? 0);

  const deductions = {
    sss: applyStat.sss ? statutory.sss : 0,
    sss_regular: applyStat.sss ? statutory.sss_regular : 0,
    sss_wisp: applyStat.sss ? statutory.sss_wisp : 0,
    sss_er: applyStat.sss ? statutory.sss_er : 0,
    sss_wisp_er: applyStat.sss ? statutory.sss_wisp_er : 0,
    sss_ecc: applyStat.sss ? statutory.sss_ecc : 0,
    philhealth: applyStat.philhealth ? statutory.philhealth : 0,
    philhealth_er: applyStat.philhealth ? statutory.philhealth_er : 0,
    pagibig: applyStat.pagibig ? statutory.pagibig : 0,
    pagibig_er: applyStat.pagibig ? statutory.pagibig_er : 0,
    withholding_tax: applyStat.wtax ? tax.tax : 0,
    taxable_income: applyStat.wtax ? tax.taxableIncome : gross,
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

  // Catch-up adjusts cash gross/net only; statutory above uses hours-based gross (ADR 0012).
  const gross_pay = round2(gross + adjustment);

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
    gross_pay,
    total_deductions,
    net_pay: round2(Math.max(0, gross_pay - total_deductions)),
    bank_name: input.payee?.bank_name ?? null,
    bank_account_no:
      input.payee?.bank_account_no ?? input.payee?.bank_account ?? null,
  };
}

export function summarizeRegisterLines(lines: BuiltRegisterLine[]) {
  return {
    line_count: lines.length,
    gross_pay: round2(lines.reduce((acc, l) => acc + l.gross_pay, 0)),
    total_deductions: round2(
      lines.reduce((acc, l) => acc + l.total_deductions, 0)
    ),
    net_pay: round2(lines.reduce((acc, l) => acc + l.net_pay, 0)),
    sss: round2(lines.reduce((acc, l) => acc + (l.deductions.sss ?? 0), 0)),
    philhealth: round2(
      lines.reduce((acc, l) => acc + (l.deductions.philhealth ?? 0), 0)
    ),
    pagibig: round2(lines.reduce((acc, l) => acc + (l.deductions.pagibig ?? 0), 0)),
    withholding_tax: round2(
      lines.reduce((acc, l) => acc + (l.deductions.withholding_tax ?? 0), 0)
    ),
    loans: round2(lines.reduce((acc, l) => acc + (l.deductions.loans ?? 0), 0)),
    adjustment: round2(
      lines.reduce((acc, l) => acc + (l.earnings.adjustment ?? 0), 0)
    ),
  };
}
