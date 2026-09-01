/**
 * Per-cutoff loan installments (GREENHRISMAIN `loanschedule` grain).
 * Payroll matches `period_start` to the cutoff's start date.
 */

export type LoanCutoffAssignment = "first" | "second" | "both";
export type LoanPaymentTerm = "monthly" | "semi-monthly";

export type LoanInstallment = {
  period_start: string;
  period_end: string;
  amount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function cutoffWindowContaining(dateIso: string): {
  start: Date;
  end: Date;
  half: "first" | "second";
} {
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (day <= 15) {
    return {
      start: utcDate(year, month, 1),
      end: utcDate(year, month, 15),
      half: "first",
    };
  }
  return {
    start: utcDate(year, month, 16),
    end: utcDate(year, month, lastDayOfMonth(year, month)),
    half: "second",
  };
}

export function nextCutoffWindow(start: Date): { start: Date; end: Date } {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const day = start.getUTCDate();
  if (day <= 15) {
    return {
      start: utcDate(year, month, 16),
      end: utcDate(year, month, lastDayOfMonth(year, month)),
    };
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    start: utcDate(nextYear, nextMonth, 1),
    end: utcDate(nextYear, nextMonth, 15),
  };
}

function assignmentForTerm(
  paymentTerm: LoanPaymentTerm,
  cutoffAssignment: LoanCutoffAssignment
): LoanCutoffAssignment {
  if (paymentTerm === "semi-monthly") return "both";
  return cutoffAssignment;
}

/**
 * Build unpaid installments from a header. Last row absorbs rounding remainder.
 */
export function generateLoanInstallments(input: {
  effectivityDate: string;
  installmentCount: number;
  perInstallment: number;
  originalBalance: number;
  paymentTerm: LoanPaymentTerm;
  cutoffAssignment?: LoanCutoffAssignment;
}): LoanInstallment[] {
  const count = Math.max(0, Math.trunc(input.installmentCount));
  const per = round2(Math.max(0, Number(input.perInstallment) || 0));
  if (count <= 0 || per <= 0) return [];

  const assignment = assignmentForTerm(
    input.paymentTerm,
    input.cutoffAssignment ?? "both"
  );
  const rows: LoanInstallment[] = [];
  let window = cutoffWindowContaining(input.effectivityDate);
  let guard = 0;

  while (rows.length < count && guard < 400) {
    guard += 1;
    const half = window.start.getUTCDate() <= 15 ? "first" : "second";
    const include = assignment === "both" || assignment === half;
    if (include) {
      rows.push({
        period_start: ymd(window.start),
        period_end: ymd(window.end),
        amount: per,
      });
    }
    window = nextCutoffWindow(window.start);
  }

  if (!rows.length) return [];

  const original = round2(Math.max(0, Number(input.originalBalance) || 0));
  if (original > 0) {
    const paidExceptLast = round2(per * (rows.length - 1));
    const last = round2(Math.max(0.01, original - paidExceptLast));
    rows[rows.length - 1] = { ...rows[rows.length - 1], amount: last };
  }

  return rows;
}

export function installmentCountFromHeader(input: {
  totalTerms: number;
  paymentTerm: LoanPaymentTerm;
  deductBiMonthly?: boolean | null;
}): number {
  const terms = Math.max(0, Math.trunc(input.totalTerms));
  if (input.paymentTerm === "semi-monthly" || input.deductBiMonthly === true) {
    return terms * 2;
  }
  return terms;
}

export function perInstallmentFromHeader(input: {
  monthlyPayment: number;
  paymentTerm: LoanPaymentTerm;
  deductBiMonthly?: boolean | null;
}): number {
  const monthly = round2(Math.max(0, Number(input.monthlyPayment) || 0));
  if (input.paymentTerm === "semi-monthly" || input.deductBiMonthly === true) {
    return round2(monthly / 2);
  }
  return monthly;
}
