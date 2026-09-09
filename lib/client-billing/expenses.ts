/**
 * Pass-through billing expenses (MAIN BILLINGEXPENSE particular/amount).
 * Stored on billing_runs.fees.expenses — does not change wrap totals.
 */

export type BillingExpenseInput = {
  particular?: unknown;
  amount?: unknown;
};

export type BillingExpenseRow = {
  particular: string;
  amount: number;
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : NaN;
}

/** Drop blank particulars and non-finite amounts. Cap list length. */
export function normalizeBillingExpenses(
  rows: BillingExpenseInput[] | null | undefined,
  opts?: { max?: number }
): BillingExpenseRow[] {
  if (!rows?.length) return [];
  const max = opts?.max ?? 200;
  const out: BillingExpenseRow[] = [];
  for (const row of rows) {
    if (out.length >= max) break;
    const particular = text(row.particular);
    if (!particular) continue;
    if (!Number.isFinite(Number(row.amount))) continue;
    const amount = n(row.amount);
    if (!Number.isFinite(amount)) continue;
    out.push({ particular, amount });
  }
  return out;
}

/** Preserve fee rates; replace expenses only. */
export function mergeBillingFeesWithExpenses(
  fees: Record<string, unknown> | null | undefined,
  expenses: BillingExpenseInput[] | null | undefined
): Record<string, unknown> {
  const base =
    fees && typeof fees === "object" && !Array.isArray(fees)
      ? { ...fees }
      : {};
  return {
    ...base,
    expenses: normalizeBillingExpenses(expenses),
  };
}
