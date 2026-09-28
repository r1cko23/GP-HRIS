/**
 * Require a cutoff id before loading Benefits amounts into a register build.
 */

export function requireCutoffPeriodId(
  cutoffPeriodId: string | null | undefined
): string {
  const id = String(cutoffPeriodId ?? "").trim();
  if (!id) {
    throw new Error("cutoff_period_id is required");
  }
  return id;
}
