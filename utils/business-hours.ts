/**
 * Business hours and late/undertime calculation (office-based).
 * Client-based employees are flexible: no default hours, no LT/UT.
 */

import { parseISO } from "date-fns";

export const OFFICE_DEFAULT_START = "08:00:00";
export const OFFICE_DEFAULT_END = "17:00:00";
export const SPECIAL_START = "09:00:00";
export const SPECIAL_END = "18:00:00";
const SPECIAL_NAMES = ["Michelle Razal", "Jon Alfeche"];

export interface DefaultHours {
  start_time: string;
  end_time: string;
}

/**
 * Default business hours for office-based employees.
 * Returns null for client-based or for rest day (Sunday).
 */
export function getDefaultBusinessHours(
  employee: { full_name?: string | null; employee_type?: string | null },
  dateStr: string,
  dayOfWeek: number
): DefaultHours | null {
  if (employee.employee_type === "client-based") return null;
  if (dayOfWeek === 0) return null; // Sunday
  const isSpecial = SPECIAL_NAMES.some(
    (name) =>
      (employee.full_name?.trim() ?? "").toLowerCase() === name.toLowerCase()
  );
  return {
    start_time: isSpecial ? SPECIAL_START : OFFICE_DEFAULT_START,
    end_time: isSpecial ? SPECIAL_END : OFFICE_DEFAULT_END,
  };
}

/**
 * Normalize time string from DB (may be "HH:mm:ss" or "HH:mm:ss.xxx" or full ISO).
 */
function normalizeTimeStr(t: string): string {
  if (t.includes("T")) return t.split("T")[1].split(".")[0];
  return t.split(".")[0];
}

/**
 * Compute late minutes: clock_in after scheduled start.
 * Returns 0 if clock in is on or before start.
 */
export function computeLateMinutes(
  clockInTime: string,
  scheduleStartTime: string
): number {
  try {
    const startStr = normalizeTimeStr(scheduleStartTime);
    const scheduledIn = parseISO(`2000-01-01T${startStr}`);
    const actualIn = parseISO(clockInTime);
    const scheduledMin =
      scheduledIn.getHours() * 60 + scheduledIn.getMinutes();
    const actualMin = actualIn.getHours() * 60 + actualIn.getMinutes();
    const diff = actualMin - scheduledMin;
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

/**
 * Compute undertime minutes: clock_out before scheduled end, only when regularHours < 8.
 */
export function computeUndertimeMinutes(
  clockOutTime: string,
  scheduleEndTime: string,
  regularHours: number
): number {
  if (regularHours >= 8) return 0;
  try {
    const endStr = normalizeTimeStr(scheduleEndTime);
    const scheduledOut = parseISO(`2000-01-01T${endStr}`);
    const actualOut = parseISO(clockOutTime);
    const scheduledMin =
      scheduledOut.getHours() * 60 + scheduledOut.getMinutes();
    const actualMin = actualOut.getHours() * 60 + actualOut.getMinutes();
    const diff = scheduledMin - actualMin;
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

export interface LateUndertimeResult {
  lateMinutes: number;
  undertimeMinutes: number;
}

/**
 * Get schedule for a date: from scheduleMap (with start_time, end_time) or default for office-based.
 */
export function getScheduleForDate(
  dateStr: string,
  dayOfWeek: number,
  employee: { full_name?: string | null; employee_type?: string | null },
  scheduleFromDb?: { start_time?: string | null; end_time?: string | null } | null
): DefaultHours | null {
  if (scheduleFromDb?.start_time && scheduleFromDb?.end_time) {
    return {
      start_time:
        typeof scheduleFromDb.start_time === "string"
          ? normalizeTimeStr(scheduleFromDb.start_time)
          : String(scheduleFromDb.start_time),
      end_time:
        typeof scheduleFromDb.end_time === "string"
          ? normalizeTimeStr(scheduleFromDb.end_time)
          : String(scheduleFromDb.end_time),
    };
  }
  return getDefaultBusinessHours(employee, dateStr, dayOfWeek);
}

/**
 * Compute late and undertime for one day (office-based only).
 */
export function computeLateUndertimeForDay(
  clockInTime: string,
  clockOutTime: string,
  regularHours: number,
  schedule: DefaultHours | null,
  isClientBased: boolean
): LateUndertimeResult {
  if (isClientBased || !schedule) {
    return { lateMinutes: 0, undertimeMinutes: 0 };
  }
  const lateMinutes = computeLateMinutes(clockInTime, schedule.start_time);
  const undertimeMinutes = computeUndertimeMinutes(
    clockOutTime,
    schedule.end_time,
    regularHours
  );
  return { lateMinutes, undertimeMinutes };
}
