/** Cutoff-scoped refund amount for payroll register adjustment. */

/**
 * Normalize a Benefits refund amount to two decimal places.
 * Missing / non-numeric values become 0.
 */
export function normalizeRefundAmount(
  value: number | string | null | undefined
): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}
