/**
 * Lifecycle helpers — Directory as source of truth for headcount + cleanup queues.
 *
 * needs_review (stale active): status=active but missing from the client's
 * latest released payroll cutoff (or no payroll in 35+ days).
 * HR verifies: still working / maternity / resign → set inactive or for_release.
 */

export const STALE_FALLBACK_DAYS = 35;

export type LifecycleFlag =
  | "ok"
  | "needs_review"
  | "for_release"
  | "inactive"
  | "barred"
  | "float"
  | "for_verification";

export type LifecycleSignals = {
  last_payroll_end: string | null;
  days_since_last_payroll: number | null;
  lifecycle_flag: LifecycleFlag;
  lifecycle_label: string;
  lifecycle_hint: string;
};

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const slice = value.slice(0, 10);
  const d = new Date(`${slice}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function computeLifecycleSignals(input: {
  status: string;
  last_payroll_end: string | null | undefined;
  client_latest_payroll_end?: string | null;
  as_of?: Date;
}): LifecycleSignals {
  const asOf = input.as_of ?? new Date();
  const last = parseDateOnly(input.last_payroll_end ?? null);
  const clientLatest = parseDateOnly(input.client_latest_payroll_end ?? null);
  const days = last ? daysBetween(last, asOf) : null;

  const status = input.status;
  if (status === "for_release") {
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: "for_release",
      lifecycle_label: "For release",
      lifecycle_hint: "Final pay in progress — may still be paid once.",
    };
  }
  if (status === "inactive") {
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: "inactive",
      lifecycle_label: days != null ? `Inactive · ${days}d since last pay` : "Inactive",
      lifecycle_hint:
        "Separated / not engaged. Confirm leave vs resign; use Rehire to return.",
    };
  }
  if (status === "barred") {
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: "barred",
      lifecycle_label: "Barred",
      lifecycle_hint: "Blocked from deployment / payroll.",
    };
  }
  if (status === "float" || status === "for_verification") {
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: status,
      lifecycle_label: status === "float" ? "Float" : "For verification",
      lifecycle_hint:
        status === "float"
          ? "Between assignments."
          : "Pending verification before full activation.",
    };
  }

  // active
  let needsReview = false;
  if (clientLatest) {
    needsReview = !last || last < clientLatest;
  } else if (!last) {
    needsReview = true;
  } else {
    needsReview = days != null && days >= STALE_FALLBACK_DAYS;
  }

  if (needsReview) {
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: "needs_review",
      lifecycle_label:
        days != null
          ? `Needs review · ${days}d since last pay`
          : "Needs review · never on payroll file",
      lifecycle_hint:
        "Marked active but not on the latest released cutoff. HR: still working, on leave, or resign → update status.",
    };
  }

  return {
    last_payroll_end: input.last_payroll_end ?? null,
    days_since_last_payroll: days,
    lifecycle_flag: "ok",
    lifecycle_label: "Active",
    lifecycle_hint: "On file for the latest cutoff / recently paid.",
  };
}
