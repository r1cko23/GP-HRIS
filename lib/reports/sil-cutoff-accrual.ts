/**
 * SIL cutoff accrual (MAIN silp grain, compute only).
 * From 2024: daysWorked / 313 × 5 × dailyRate per kinsena.
 */

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Statutory working days MAIN uses for SIL from 2024 onward. */
export const SIL_WORKING_DAYS = 313;

export function silCutoffAccrual(daysWorked: unknown, dailyRate: unknown): number {
  const days = n(daysWorked);
  const rate = n(dailyRate);
  if (days <= 0 || rate <= 0) return 0;
  return round2((days / SIL_WORKING_DAYS) * 5 * rate);
}
