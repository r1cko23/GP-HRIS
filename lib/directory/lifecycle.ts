/**
 * Lifecycle helpers — Directory as source of truth for headcount + cleanup queues.
 *
 * needs_review (stale active): status=active but missing from the client's
 * latest released payroll cutoff (or no payroll in 35+ days).
 * HR verifies: still working / maternity / resign → set inactive or for_release.
 */

export const STALE_FALLBACK_DAYS = 35;

/** Barred when final pay is still unclaimed this long after last payout. */
export const UNCLAIMED_FINAL_PAY_DAYS = 365 * 3;

export function isAgedUnclaimedFinalPay(
  lastPayrollEnd: string | null | undefined,
  asOf: Date = new Date()
): boolean {
  const last = parseDateOnly(lastPayrollEnd ?? null);
  if (!last) return false;
  return daysBetween(last, asOf) >= UNCLAIMED_FINAL_PAY_DAYS;
}

/** Stale for-release (last payout ≥ 3 years, not claimed) is barred. */
export function effectiveEngagementStatus(
  status: string,
  lastPayrollEnd: string | null | undefined,
  asOf: Date = new Date()
): string {
  if (status === "for_release" && isAgedUnclaimedFinalPay(lastPayrollEnd, asOf)) {
    return "barred";
  }
  return status;
}

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

export type BarredKind = "unclaimed_final_pay" | "deployment_block";

/** Barred is two kinds: aged unclaimed final pay vs a deployment hold. */
export function barredKind(
  status: string,
  lastPayrollEnd: string | null | undefined,
  asOf: Date = new Date()
): BarredKind | null {
  if (status !== "barred") return null;
  return isAgedUnclaimedFinalPay(lastPayrollEnd, asOf)
    ? "unclaimed_final_pay"
    : "deployment_block";
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
    if (isAgedUnclaimedFinalPay(input.last_payroll_end, asOf)) {
      return {
        last_payroll_end: input.last_payroll_end ?? null,
        days_since_last_payroll: days,
        lifecycle_flag: "barred",
        lifecycle_label: "Barred",
        lifecycle_hint:
          "Final pay unclaimed for more than 3 years (365 × 3). Barred — not a live for-release.",
      };
    }
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
    const aged = days != null && days >= UNCLAIMED_FINAL_PAY_DAYS;
    return {
      last_payroll_end: input.last_payroll_end ?? null,
      days_since_last_payroll: days,
      lifecycle_flag: "barred",
      lifecycle_label: "Barred",
      lifecycle_hint: aged
        ? "Final pay unclaimed for more than 3 years (365 × 3). Use Rehire — this tenure stays barred."
        : "Blocked from deployment / payroll. Activate on this tenure after clearance.",
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
