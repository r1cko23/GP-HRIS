/**
 * Daily / monthly rate precision for Directory + Organic payroll.
 *
 * Schema stores daily rates as NUMERIC(12, 4). UI shows money at 2dp.
 * Monthly basis is daily × 26, rounded to cents — never round daily to 2dp
 * before multiplying (3538.46 × 26 = 91999.96 vs 92000/26 retained).
 */

export const WORKING_DAYS_PER_MONTH = 26;

/** Centavos for money amounts (monthly, contributions, payslip lines). */
export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Directory / office daily rate storage precision. */
export function roundDailyRate4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Monthly salary from a (possibly high-precision) daily rate. */
export function monthlyFromDailyRate(
  dailyRate: number,
  workingDaysPerMonth: number = WORKING_DAYS_PER_MONTH
): number {
  return roundMoney2(dailyRate * workingDaysPerMonth);
}

/** Daily rate derived from an intended monthly (retain 4dp). */
export function dailyFromMonthlyRate(
  monthlyRate: number,
  workingDaysPerMonth: number = WORKING_DAYS_PER_MONTH
): number {
  if (!(workingDaysPerMonth > 0)) return 0;
  return roundDailyRate4(monthlyRate / workingDaysPerMonth);
}

/**
 * When a stored daily was rounded to 2dp and daily×26 sits within ₱0.05 of a
 * whole peso, restore daily = round_peso(monthly) / 26 at 4dp.
 */
export function restoreDailyRatePrecision(
  dailyRate: number | string | null | undefined,
  workingDaysPerMonth: number = WORKING_DAYS_PER_MONTH
): number | null {
  const daily = Number(dailyRate ?? 0);
  if (!Number.isFinite(daily) || daily <= 0) return null;

  const monthlyRaw = daily * workingDaysPerMonth;
  const monthlyPeso = Math.round(monthlyRaw);
  const drift = Math.abs(monthlyRaw - monthlyPeso);
  if (drift > 0.001 && drift < 0.05) {
    return dailyFromMonthlyRate(monthlyPeso, workingDaysPerMonth);
  }
  return roundDailyRate4(daily);
}

/** Format a daily rate for edit inputs (up to 4dp, trim trailing zeros). */
export function formatDailyRateInput(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return roundDailyRate4(n)
    .toFixed(4)
    .replace(/\.?0+$/, "");
}
