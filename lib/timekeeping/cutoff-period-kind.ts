/**
 * Cutoff period kind: regular kinsena vs hours-based Adjustment run (ADR 0017).
 */

export const CUTOFF_PERIOD_KINDS = ["regular", "adjustment"] as const;
export type CutoffPeriodKind = (typeof CUTOFF_PERIOD_KINDS)[number];

export function isCutoffPeriodKind(value: unknown): value is CutoffPeriodKind {
  return (
    typeof value === "string" &&
    (CUTOFF_PERIOD_KINDS as readonly string[]).includes(value)
  );
}

export function parseCutoffPeriodKind(value: unknown): CutoffPeriodKind {
  return isCutoffPeriodKind(value) ? value : "regular";
}

export function isAdjustmentCutoff(period: {
  period_kind?: string | null;
}): boolean {
  return parseCutoffPeriodKind(period.period_kind) === "adjustment";
}

/** Register / PDF title for the cutoff kind. */
export function cutoffRegisterTitle(period: {
  period_kind?: string | null;
}): string {
  return isAdjustmentCutoff(period) ? "Payroll Adjustment" : "Payroll Summary";
}

export function formatCutoffPeriodKindLabel(kind: CutoffPeriodKind): string {
  return kind === "adjustment" ? "Adjustment" : "Regular";
}
