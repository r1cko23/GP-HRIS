/**
 * Shared cutoff payslip computation (Frappe HR Salary Structure pattern).
 * Used by bulk Payroll Entry and individual payslip generation.
 */

import { calculateSSS } from "@/utils/ph-deductions";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import type { CutoffDeductions } from "./types";
import { getRatePerHour, getMonthlySalary, type RateEmployee } from "./employee-rates";
import {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "./statutory-cutoff";

export interface LoanRow {
  loan_type: string;
  monthly_payment: number;
  cutoff_assignment: string;
  deduct_bi_monthly?: boolean | null;
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
  cutoffStatutory: ReturnType<typeof getCutoffStatutoryDeductions>;
  loanTotals: ReturnType<typeof sumLoansForCutoff>;
}

function isFirstCutoff(periodStart: Date): boolean {
  return periodStart.getDate() <= 15;
}

export function sumLoansForCutoff(
  loans: LoanRow[],
  firstCutoff: boolean
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

  const cutoffKey = firstCutoff ? "first" : "second";

  for (const loan of loans) {
    const assignment = loan.cutoff_assignment || "both";
    if (assignment !== "both" && assignment !== cutoffKey) continue;

    const payment = Number(loan.monthly_payment) || 0;
    if (payment <= 0) continue;

    const deductBiMonthly = loan.deduct_bi_monthly !== false;
    const amount = deductBiMonthly ? payment / 2 : payment;

    switch (loan.loan_type) {
      case "sss":
        totals.sssLoan += amount;
        break;
      case "pagibig":
        totals.pagibigLoan += amount;
        break;
      case "company":
        totals.companyLoan += amount;
        break;
      case "emergency":
        totals.emergencyLoan += amount;
        break;
      default:
        totals.otherLoan += amount;
    }
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
  const firstCutoff = isFirstCutoff(periodStart);

  let grossPay = grossPayOverride ?? 0;
  if (grossPay <= 0 && attendanceData.length > 0 && ratePerHour > 0) {
    const payrollResult = calculateWeeklyPayroll(
      attendanceData as unknown as Parameters<typeof calculateWeeklyPayroll>[0],
      ratePerHour
    );
    grossPay = Math.round(payrollResult.grossPay * 100) / 100;
  }

  grossPay = Math.round((grossPay + adjustmentAmount) * 100) / 100;

  const loanTotals = sumLoansForCutoff(loans, firstCutoff);
  const cutoffStatutory = getCutoffStatutoryDeductions(monthlySalary);
  const sssContribution = calculateSSS(monthlySalary);
  const sssRegularAmount =
    Math.round((sssContribution.regularEmployeeShare / 2) * 100) / 100;
  const sssWispAmount =
    sssContribution.wispEmployeeShare > 0
      ? Math.round((sssContribution.wispEmployeeShare / 2) * 100) / 100
      : 0;

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
