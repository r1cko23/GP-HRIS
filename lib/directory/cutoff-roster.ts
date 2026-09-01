import { isPayrollEligibleStatus } from "@/lib/directory/employees";

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
 * Cutoff roster row: current Engagement, payroll-eligible status,
 * overlapping the window. For-release stays until a resign date exists.
 */
export function isCutoffRosterRow(
  engagement: EngagementForCutoff,
  periodStart: string,
  periodEnd: string
): boolean {
  if (engagement.is_current_engagement === false) return false;
  if (!isPayrollEligibleStatus(engagement.status)) return false;
  return engagementOverlapsCutoff(engagement, periodStart, periodEnd);
}
