/**
 * Regular kinsena roster (GREENHRISMAIN `usp_employeeactivelist`, not
 * `usp_employeeforreleaselist`). For-release stays on the final-pay list.
 */
export function isRegularCutoffStatus(status: string): boolean {
  return status === "active";
}

export type EngagementForCutoff = {
  status: string;
  hire_date?: string | null;
  resign_date?: string | null;
  is_current_engagement?: boolean | null;
};

function day(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  return d || null;
}

/** Hire/resign overlap a Cutoff period. Null hire counts as already hired. */
export function engagementOverlapsCutoff(
  engagement: EngagementForCutoff,
  periodStart: string,
  periodEnd: string
): boolean {
  const start = periodStart.slice(0, 10);
  const end = periodEnd.slice(0, 10);
  const hired = day(engagement.hire_date);
  const resigned = day(engagement.resign_date);
  if (hired && hired > end) return false;
  if (resigned && resigned < start) return false;
  return true;
}

/**
 * Regular cutoff roster: current Active Engagement overlapping the window.
 * For-release / inactive are excluded (final pay is a separate run).
 */
export function isCutoffRosterRow(
  engagement: EngagementForCutoff,
  periodStart: string,
  periodEnd: string
): boolean {
  if (engagement.is_current_engagement === false) return false;
  if (!isRegularCutoffStatus(engagement.status)) return false;
  return engagementOverlapsCutoff(engagement, periodStart, periodEnd);
}
