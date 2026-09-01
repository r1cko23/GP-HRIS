/**
 * Shared cutoff payslip computation (Frappe HR Salary Structure pattern).
 * Used by bulk Payroll Entry and individual payslip generation.
 */

import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import type { CutoffDeductions, CutoffStatutoryDeductions } from "./types";
import { getRatePerHour, getMonthlySalary, type RateEmployee } from "./employee-rates";
import {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "./statutory-cutoff";
import { bucketLoanType, deductionForCutoff } from "@/lib/loans/deduct";

export interface LoanRow {
  id?: string;
  loan_type: string;
  particular?: string | null;
  monthly_payment: number;
  cutoff_assignment: string;
  deduct_bi_monthly?: boolean | null;
  current_balance?: number | null;
  effectivity_date?: string | null;
  scheduled_amount?: number | null;
  schedule_id?: string | null;
}

export interface ComputeCutoffPayslipInput {
  employee: RateEmployee;
  periodStart: Date;
  attendanceData: Array<Record<string, unknown>>;
  grossPayOverride?: number;
  deductions: CutoffDeductions;
  loans: LoanRow[];
  adjustmentAmount?: number;
}

export interface CutoffPayslipAmounts {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  monthlySalary: number;
  ratePerHour: number;
  deductionsBreakdown: {
    weekly: {
      vale: number;
      sss_loan: number;
      sss_calamity: number;
      pagibig_loan: number;
      pagibig_calamity: number;
      monthly_loans: {
        sssLoan: number;
        pagibigLoan: number;
        companyLoan: number;
        emergencyLoan: number;
        otherLoan: number;
      };
    };
    tax: number;
    sss: number;
    sss_wisp: number;
    philhealth: number;
    pagibig: number;
  };
  cutoffStatutory: CutoffStatutoryDeductions;
  loanTotals: ReturnType<typeof sumLoansForCutoff>;
}

export function sumLoansForCutoff(
  loans: LoanRow[],
  periodStart: Date
): {
  sssLoan: number;
  pagibigLoan: number;
  companyLoan: number;
  emergencyLoan: number;
  otherLoan: number;
  total: number;
} {
  const totals = {
    sssLoan: 0,
    pagibigLoan: 0,
    companyLoan: 0,
    emergencyLoan: 0,
    otherLoan: 0,
    total: 0,
  };

  for (const loan of loans) {
    const scheduled =
      loan.scheduled_amount != null
        ? {
            id: loan.schedule_id ?? loan.id ?? "scheduled",
            amount: Number(loan.scheduled_amount),
          }
        : null;
    const { amount } = deductionForCutoff({
      loan,
      periodStart,
      scheduled,
    });
    if (amount <= 0) continue;

    totals[bucketLoanType(loan.loan_type)] += amount;
    totals.total += amount;
  }

  for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
    if (key !== "total") {
      totals[key] = Math.round(totals[key] * 100) / 100;
    }
  }
  totals.total = Math.round(totals.total * 100) / 100;

  return totals;
}

export function computeCutoffPayslipAmounts(
  input: ComputeCutoffPayslipInput
): CutoffPayslipAmounts {
  const {
    employee,
    periodStart,
    attendanceData,
    grossPayOverride,
    deductions,
    loans,
    adjustmentAmount = 0,
  } = input;

  const ratePerHour = getRatePerHour(employee);
  const monthlySalary = getMonthlySalary(employee);

  let grossPay = grossPayOverride ?? 0;
  if (grossPay <= 0 && attendanceData.length > 0 && ratePerHour > 0) {
    const payrollResult = calculateWeeklyPayroll(
      attendanceData as unknown as Parameters<typeof calculateWeeklyPayroll>[0],
      ratePerHour
    );
    grossPay = Math.round(payrollResult.grossPay * 100) / 100;
  }

  grossPay = Math.round((grossPay + adjustmentAmount) * 100) / 100;

  const loanTotals = sumLoansForCutoff(loans, periodStart);
  const cutoffStatutory = getCutoffStatutoryDeductions(monthlySalary);
  const sssRegularAmount = cutoffStatutory.sss_regular;
  const sssWispAmount = cutoffStatutory.sss_wisp;

  let totalDeductions =
    deductions.vale_amount +
    deductions.sss_salary_loan +
    deductions.sss_calamity_loan +
    deductions.pagibig_salary_loan +
    deductions.pagibig_calamity_loan +
    loanTotals.total +
    cutoffStatutory.total;

  const taxResult = computeCutoffWithholdingTax(
    grossPay,
    monthlySalary,
    deductions.withholding_tax || undefined
  );
  totalDeductions += taxResult.tax;

  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

  const deductionsBreakdown = {
    weekly: {
      vale: deductions.vale_amount,
      sss_loan: deductions.sss_salary_loan,
      sss_calamity: deductions.sss_calamity_loan,
      pagibig_loan: deductions.pagibig_salary_loan,
      pagibig_calamity: deductions.pagibig_calamity_loan,
      monthly_loans: {
        sssLoan: loanTotals.sssLoan,
        pagibigLoan: loanTotals.pagibigLoan,
        companyLoan: loanTotals.companyLoan,
        emergencyLoan: loanTotals.emergencyLoan,
        otherLoan: loanTotals.otherLoan,
      },
    },
    tax: taxResult.tax,
    sss: sssRegularAmount,
    sss_wisp: sssWispAmount,
    philhealth: cutoffStatutory.philhealth,
    pagibig: cutoffStatutory.pagibig,
  };

  return {
    grossPay,
    totalDeductions,
    netPay,
    monthlySalary,
    ratePerHour,
    deductionsBreakdown,
    cutoffStatutory,
    loanTotals,
  };
}
