/**
 * Amount to take on one cutoff: schedule row if present, else header fallback.
 * Always cap at remaining balance. Skip before effectivity.
 */

export type DeductableLoan = {
  id?: string;
  loan_type: string;
  monthly_payment: number;
  cutoff_assignment?: string | null;
  deduct_bi_monthly?: boolean | null;
  current_balance?: number | null;
  effectivity_date?: string | null;
};

export type LoanScheduleMatch = {
  id: string;
  amount: number;
};

export type LoanDeduction = {
  amount: number;
  schedule_id: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function deductionForCutoff(input: {
  loan: DeductableLoan;
  periodStart: Date;
  periodEnd?: Date;
  scheduled?: LoanScheduleMatch | null;
}): LoanDeduction {
  const loan = input.loan;
  const balance = Number(loan.current_balance);
  const cap =
    Number.isFinite(balance) && balance >= 0 ? round2(balance) : Number.POSITIVE_INFINITY;

  if (loan.effectivity_date) {
    const end = input.periodEnd ?? input.periodStart;
    if (ymd(end) < loan.effectivity_date.slice(0, 10)) {
      return { amount: 0, schedule_id: null };
    }
  }

  if (input.scheduled && input.scheduled.amount > 0) {
    const amount = round2(Math.min(input.scheduled.amount, cap));
    if (amount <= 0) return { amount: 0, schedule_id: null };
    return { amount, schedule_id: input.scheduled.id };
  }

  const assignment = loan.cutoff_assignment || "both";
  const cutoffKey = input.periodStart.getUTCDate() <= 15 ? "first" : "second";
  if (assignment !== "both" && assignment !== cutoffKey) {
    return { amount: 0, schedule_id: null };
  }

  const payment = Number(loan.monthly_payment) || 0;
  if (payment <= 0) return { amount: 0, schedule_id: null };
  const deductBiMonthly = loan.deduct_bi_monthly !== false;
  const raw = deductBiMonthly ? payment / 2 : payment;
  const amount = round2(Math.min(raw, cap));
  if (amount <= 0) return { amount: 0, schedule_id: null };
  return { amount, schedule_id: null };
}

export function bucketLoanType(loanType: string):
  | "sssLoan"
  | "pagibigLoan"
  | "companyLoan"
  | "emergencyLoan"
  | "otherLoan" {
  switch (loanType) {
    case "sss":
      return "sssLoan";
    case "pagibig":
      return "pagibigLoan";
    case "company":
      return "companyLoan";
    case "emergency":
      return "emergencyLoan";
    default:
      return "otherLoan";
  }
}
