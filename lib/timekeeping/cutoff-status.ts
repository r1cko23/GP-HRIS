import {
  CUTOFF_PERIOD_STATUSES,
  type CutoffPeriodStatus,
} from "./cutoff-types";

const ALLOWED_TRANSITIONS: Record<
  CutoffPeriodStatus,
  readonly CutoffPeriodStatus[]
> = {
  draft: ["pending_audit", "cancelled"],
  pending_audit: ["approved", "draft", "cancelled"],
  approved: ["posted", "pending_audit"],
  posted: [],
  cancelled: ["draft"],
};

export function canTransitionCutoffStatus(
  from: CutoffPeriodStatus,
  to: CutoffPeriodStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Draft / pending-audit only. Posted payroll is immutable (ADR 0017). */
export function canDeleteCutoffPeriod(
  status: string | null | undefined
): boolean {
  return status === "draft" || status === "pending_audit";
}

export function cutoffDeleteDenial(
  status: string | null | undefined
): string | null {
  if (canDeleteCutoffPeriod(status)) return null;
  if (status === "approved") {
    return "Approved cutoffs cannot be deleted. Return to pending audit first.";
  }
  if (status === "posted") {
    return "Posted cutoffs cannot be deleted. Use an hours-based Adjustment run for corrections.";
  }
  if (status === "cancelled") {
    return "This cutoff is already cancelled.";
  }
  return "Only draft or pending-audit cutoffs can be deleted.";
}

export function assertCutoffStatus(value: string): CutoffPeriodStatus | null {
  return CUTOFF_PERIOD_STATUSES.includes(value as CutoffPeriodStatus)
    ? (value as CutoffPeriodStatus)
    : null;
}

export function cutoffStatusPatchFields(
  next: CutoffPeriodStatus,
  userId: string | null
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: next,
    updated_at: new Date().toISOString(),
  };

  if (next === "pending_audit") {
    patch.audited_by = userId;
    patch.audited_at = new Date().toISOString();
  }

  if (next === "approved") {
    patch.approved_by = userId;
    patch.approved_at = new Date().toISOString();
  }

  if (next === "draft") {
    patch.approved_by = null;
    patch.approved_at = null;
    patch.audited_by = null;
    patch.audited_at = null;
  }

  return patch;
}
