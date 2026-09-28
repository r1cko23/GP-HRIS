/**
 * SSS is withheld only when net before SSS is strictly above ₱2,000.
 * Matches HR rule: less than / equal ₱2,000 NET → no SSS deduction.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Minimum net (before SSS) required to withhold SSS. */
export const SSS_NET_FLOOR = 2000;

export function shouldDeductSss(netBeforeSssAmount: number): boolean {
  const net = Number(netBeforeSssAmount);
  if (!Number.isFinite(net)) return false;
  return round2(net) > SSS_NET_FLOOR;
}

export function netBeforeSss(input: {
  gross: number;
  philhealth?: number | null;
  pagibig?: number | null;
  withholding_tax?: number | null;
  loans?: number | null;
  other?: number | null;
}): number {
  const gross = Number(input.gross) || 0;
  const philhealth = Number(input.philhealth) || 0;
  const pagibig = Number(input.pagibig) || 0;
  const withholding_tax = Number(input.withholding_tax) || 0;
  const loans = Number(input.loans) || 0;
  const other = Number(input.other) || 0;
  return round2(
    gross - philhealth - pagibig - withholding_tax - loans - other
  );
}
