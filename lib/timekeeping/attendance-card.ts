/** Cutoff punch signals used to filter the attendance employee picker. */

import { eachDayOfInterval, startOfDay } from "date-fns";

export type CutoffPunchSignal = {
  employeeId: string;
  status: string;
  clockOutTime: string | null;
};

export function cutoffPunchNeedsAttention(punch: {
  status: string;
  clockOutTime: string | null;
}): boolean {
  if (punch.status === "rejected" || punch.status === "pending") return false;
  if (punch.status === "clocked_out") return true;
  if (punch.status === "clocked_in" || !punch.clockOutTime) return true;
  return false;
}

/** Employees with an incomplete punch or a punch still waiting for review. */
export function employeeIdsNeedingAttention(
  punches: CutoffPunchSignal[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const punch of punches) {
    if (!cutoffPunchNeedsAttention(punch) || seen.has(punch.employeeId)) continue;
    seen.add(punch.employeeId);
    ids.push(punch.employeeId);
  }
  return ids;
}

/** Entry-status label shown beside BH / Late on the attendance card. */
export function punchEntryStatusLabel(punch: {
  status: string;
  clockOutTime: string | null;
}): string {
  if (!punch.clockOutTime || punch.status === "clocked_in") return "Incomplete";
  switch (punch.status) {
    case "clocked_out":
      return "Needs review";
    case "approved":
      return "Approved";
    case "auto_approved":
      return "Auto approved";
    case "rejected":
      return "Rejected";
    case "pending":
      return "Pending";
    default:
      return punch.status.replace(/_/g, " ");
  }
}

/** Hours line for one clock entry on the attendance card. */
export function punchHoursLabel(punch: {
  regularHours: number | null;
  totalHours: number | null;
}): string | null {
  const hours =
    punch.regularHours && punch.regularHours > 0
      ? punch.regularHours
      : punch.totalHours && punch.totalHours > 0
        ? punch.totalHours
        : null;
  if (hours == null) return null;
  return `${Number(hours.toFixed(2))}h`;
}

/** Second line under punch times: office name, then address when different. */
export function punchEntryPlaceLabel(details: {
  name: string;
  address?: string | null;
  coordinates?: string | null;
}): string | null {
  const noPlace =
    !details.coordinates &&
    (!details.name || details.name === "No GPS data");
  if (noPlace) return null;
  if (details.address && details.address !== details.name) {
    return `${details.name} · ${details.address}`;
  }
  return details.name || null;
}

/** Free date range for the attendance card (any start/end, not only 1–15 / 16–EOM). */
export function normalizeAttendanceDateRange(
  start: Date,
  end: Date
): { start: Date; end: Date } {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) {
    return { start: endDay, end: startDay };
  }
  return { start: startDay, end: endDay };
}

/** Inclusive calendar days for the attendance card range. */
export function attendanceDaysInRange(start: Date, end: Date): Date[] {
  const range = normalizeAttendanceDateRange(start, end);
  return eachDayOfInterval({ start: range.start, end: range.end });
}

/**
 * Punch actions on the attendance card.
 * Edit / remove / add are never offered — punches stay as recorded; HR may review.
 */
export function attendanceCardActionFlags(input: {
  canUpdateTimeEntries: boolean;
}): {
  canReview: boolean;
  canEdit: boolean;
  canAdd: boolean;
  canRemove: boolean;
} {
  return {
    canReview: input.canUpdateTimeEntries,
    canEdit: false,
    canRemove: false,
    canAdd: false,
  };
}
