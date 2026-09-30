/**
 * Organic manual DTR for the attendance card.
 * Same entry as the client timesheet: time in, time out, and OT OK.
 * The grid is the bi-monthly cutoff (the 13-day pay window).
 * Saved punches are manual clock rows; approved OT OK becomes an overtime request.
 */

import { format } from "date-fns";
import { PREMIUM_RATES } from "../ph-payroll/premiums";
import { determineDayType, type Holiday } from "../../utils/holidays";
import { attendanceDaysInRange } from "./attendance-card";
import { buildManualClockInsert, type ManualClockInsert } from "./clock-entry-edits";
import { manilaDateKey, manilaLocalToIso } from "./zkteco-attlog";

export const MANUAL_DTR_REASON = "Manual DTR";
export const ORGANIC_DUTY_START = "08:00";
export const ORGANIC_DUTY_END = "17:00";

const LUNCH_DEDUCT_AFTER_MIN = 5 * 60;
const LUNCH_MIN = 60;
const REGULAR_CAP_MIN = 8 * 60;

export type ManualDtrLeaveTag = "" | "SIL" | "LWOP" | "RD" | "WDO";

export type ManualDtrRowInput = {
  date: string;
  timeIn: string;
  timeOut: string;
  otInOk: boolean;
  otOutOk: boolean;
  locked: boolean;
  dutyStart?: string;
  dutyEnd?: string;
  leaveTag?: ManualDtrLeaveTag;
  /** Approved leave filed outside this sheet. Shown, not rewritten. */
  leaveLocked?: boolean;
};

export type ManualDtrLeaveRow = {
  employee_id: string;
  leave_type: "SIL" | "LWOP";
  start_date: string;
  end_date: string;
  total_days: 1;
  reason: string;
  status: "approved_by_hr";
  selected_dates: string[];
};

export type ManualDtrOvertimeRow = {
  employee_id: string;
  ot_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string;
  status: "approved";
};

export type OrganicDtrLine = {
  regularHours: number;
  otInHours: number;
  otOutHours: number;
  lateMinutes: number;
  invalidOrder: boolean;
};

export function isManualDtrEmployee(input: {
  biometricMapped: boolean;
  hasBundyOrDevicePunch: boolean;
}): boolean {
  return !input.biometricMapped && !input.hasBundyOrDevicePunch;
}

export function cutoffHasBundyOrDevicePunch(
  entries: { is_manual_entry?: boolean | null }[]
): boolean {
  return entries.some((entry) => !entry.is_manual_entry);
}

/** Inclusive Manila calendar days for the cutoff already chosen on Attendance. */
export function manualDtrDateKeys(start: Date, end: Date): string[] {
  return attendanceDaysInRange(start, end).map((day) => format(day, "yyyy-MM-dd"));
}

export function parseHm(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toHms(value: string): string {
  const minutes = parseHm(value);
  if (minutes == null) return "00:00:00";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function organicDutyForDate(
  schedule?: { start_time?: string | null; end_time?: string | null; day_off?: boolean } | null
): { start: string; end: string } {
  if (schedule && !schedule.day_off && schedule.start_time && schedule.end_time) {
    return {
      start: schedule.start_time.slice(0, 5),
      end: schedule.end_time.slice(0, 5),
    };
  }
  return { start: ORGANIC_DUTY_START, end: ORGANIC_DUTY_END };
}

/** Pay label for a DTR tag. Rest day and WDO use the Organic premium rates. */
export function manualDtrRateLabel(tag: ManualDtrLeaveTag): string | null {
  if (tag === "RD") return `Rest day · ${Math.round(PREMIUM_RATES.rest_day * 100)}%`;
  if (tag === "WDO") return `WDO · ${Math.round(PREMIUM_RATES.wdo * 100)}%`;
  return null;
}

function manualDtrNotes(tag: ManualDtrLeaveTag | undefined): string {
  if (tag === "WDO") return "Manual DTR WDO";
  if (tag === "RD") return "Manual DTR RD";
  return MANUAL_DTR_REASON;
}

/** Same holiday detector as Time Attendance: regular → RH, special → SH. */
export function manualDtrHolidayMark(
  date: string,
  holidays: Holiday[]
): { code: "RH" | "SH"; name: string } | null {
  const dayType = determineDayType(date, holidays);
  const holiday = holidays.find((item) => item.date.slice(0, 10) === date.slice(0, 10));
  if (dayType === "regular-holiday" || dayType === "sunday-regular-holiday") {
    return { code: "RH", name: holiday?.name ?? "Regular holiday" };
  }
  if (dayType === "non-working-holiday" || dayType === "sunday-special-holiday") {
    return { code: "SH", name: holiday?.name ?? "Special holiday" };
  }
  return null;
}

export function manualDtrPaidRegularHours(input: {
  leaveTag?: ManualDtrLeaveTag;
  regularHours: number;
}): number {
  if (input.leaveTag === "SIL") return 8;
  if (input.leaveTag === "LWOP") return 0;
  return input.regularHours;
}

/** OT hours appear and are filed only after that side's OK box is checked. */
export function visibleDtrOt(hours: number, ok: boolean): number {
  return ok && hours > 0 ? hours : 0;
}

export function computeOrganicDtrLine(input: {
  timeIn: string;
  timeOut: string;
  dutyStart?: string;
  dutyEnd?: string;
}): OrganicDtrLine {
  const empty: OrganicDtrLine = {
    regularHours: 0,
    otInHours: 0,
    otOutHours: 0,
    lateMinutes: 0,
    invalidOrder: false,
  };
  const dutyStart = parseHm(input.dutyStart || ORGANIC_DUTY_START);
  const dutyEnd = parseHm(input.dutyEnd || ORGANIC_DUTY_END);
  const timeIn = parseHm(input.timeIn);
  const timeOut = parseHm(input.timeOut);
  if (dutyStart == null || dutyEnd == null || timeIn == null || timeOut == null) return empty;
  if (timeOut <= timeIn || dutyEnd <= dutyStart) {
    return { ...empty, invalidOrder: true };
  }

  const otInMin = Math.max(0, dutyStart - timeIn);
  const otOutMin = Math.max(0, timeOut - dutyEnd);
  const overlapStart = Math.max(timeIn, dutyStart);
  const overlapEnd = Math.min(timeOut, dutyEnd);
  let overlap = Math.max(0, overlapEnd - overlapStart);
  if (overlap > LUNCH_DEDUCT_AFTER_MIN) {
    overlap = Math.max(0, overlap - LUNCH_MIN);
  }

  return {
    regularHours: round2(Math.min(REGULAR_CAP_MIN, overlap) / 60),
    otInHours: round2(otInMin / 60),
    otOutHours: round2(otOutMin / 60),
    lateMinutes: Math.max(0, timeIn - dutyStart),
    invalidOrder: false,
  };
}

function manilaClock(date: string, hm: string): Date | null {
  const iso = manilaLocalToIso(`${date} ${toHms(hm)}`);
  if (!iso) return null;
  return new Date(iso);
}

export function buildManualDtrSave(input: {
  employeeId: string;
  rows: ManualDtrRowInput[];
  editorLabel: string;
  nowMs?: number;
}):
  | { error: string }
  | {
      clockRows: ManualClockInsert[];
      overtimeRows: ManualDtrOvertimeRow[];
      leaveRows: ManualDtrLeaveRow[];
      restDays: string[];
      replaceDates: string[];
      warnings: string[];
    } {
  const clockRows: ManualClockInsert[] = [];
  const overtimeRows: ManualDtrOvertimeRow[] = [];
  const leaveRows: ManualDtrLeaveRow[] = [];
  const restDays: string[] = [];
  const replaceDates: string[] = [];
  const warnings: string[] = [];

  for (const row of input.rows) {
    if (row.locked) continue;
    const timeIn = row.timeIn.trim();
    const timeOut = row.timeOut.trim();
    if (row.leaveLocked && (row.leaveTag === "SIL" || row.leaveTag === "LWOP")) {
      replaceDates.push(row.date);
      continue;
    }
    if (row.leaveTag === "SIL" || row.leaveTag === "LWOP") {
      replaceDates.push(row.date);
      leaveRows.push({
        employee_id: input.employeeId,
        leave_type: row.leaveTag,
        start_date: row.date,
        end_date: row.date,
        total_days: 1,
        reason: MANUAL_DTR_REASON,
        status: "approved_by_hr",
        selected_dates: [row.date],
      });
      continue;
    }
    if (row.leaveTag === "RD" || row.leaveTag === "WDO") {
      restDays.push(row.date);
      if (!timeIn && !timeOut) {
        replaceDates.push(row.date);
        continue;
      }
    }
    if (!timeIn && !timeOut) {
      replaceDates.push(row.date);
      continue;
    }
    if (!timeIn || !timeOut) {
      warnings.push(`Enter both time in and time out for ${row.date}`);
      continue;
    }

    const dutyStart = row.dutyStart || ORGANIC_DUTY_START;
    const dutyEnd = row.dutyEnd || ORGANIC_DUTY_END;
    const line = computeOrganicDtrLine({
      timeIn,
      timeOut,
      dutyStart,
      dutyEnd,
    });
    if (line.invalidOrder) {
      warnings.push(`Time out must be after time in for ${row.date}`);
      continue;
    }

    const clockIn = manilaClock(row.date, timeIn);
    const clockOut = manilaClock(row.date, timeOut);
    if (!clockIn || !clockOut) {
      warnings.push(`Enter a valid time for ${row.date}`);
      continue;
    }

    const inserted = buildManualClockInsert({
      employeeId: input.employeeId,
      clockIn,
      clockOut,
      notes: manualDtrNotes(row.leaveTag),
      editorLabel: input.editorLabel,
      nowMs: input.nowMs,
    });
    if ("error" in inserted) {
      warnings.push(`${row.date}: ${inserted.error}`);
      continue;
    }
    replaceDates.push(row.date);
    clockRows.push(inserted.row);

    if (row.otInOk && line.otInHours > 0) {
      overtimeRows.push({
        employee_id: input.employeeId,
        ot_date: row.date,
        end_date: row.date,
        start_time: toHms(timeIn),
        end_time: toHms(dutyStart),
        total_hours: line.otInHours,
        reason: MANUAL_DTR_REASON,
        status: "approved",
      });
    }
    if (row.otOutOk && line.otOutHours > 0) {
      overtimeRows.push({
        employee_id: input.employeeId,
        ot_date: row.date,
        end_date: row.date,
        start_time: toHms(dutyEnd),
        end_time: toHms(timeOut),
        total_hours: line.otOutHours,
        reason: MANUAL_DTR_REASON,
        status: "approved",
      });
    }
  }

  if (
    clockRows.length === 0 &&
    leaveRows.length === 0 &&
    restDays.length === 0 &&
    warnings.length > 0
  ) {
    return { error: warnings[0] };
  }

  return { clockRows, overtimeRows, leaveRows, restDays, replaceDates, warnings };
}

export function manualDtrIdsToReplace(input: {
  replaceDates: string[];
  clocks: { id: string; clock_in_time: string; is_manual_entry?: boolean | null }[];
  overtime: { id: string; ot_date: string; reason?: string | null }[];
  leaves?: { id: string; start_date: string; reason?: string | null; selected_dates?: string[] | null }[];
}): { clockIds: string[]; overtimeIds: string[]; leaveIds: string[] } {
  const dates = new Set(input.replaceDates);
  const clockIds = input.clocks
    .filter(
      (entry) =>
        Boolean(entry.is_manual_entry) && dates.has(manilaDateKey(entry.clock_in_time))
    )
    .map((entry) => entry.id);
  const overtimeIds = input.overtime
    .filter(
      (request) => request.reason === MANUAL_DTR_REASON && dates.has(request.ot_date.slice(0, 10))
    )
    .map((request) => request.id);
  const leaveIds = (input.leaves ?? [])
    .filter((request) => {
      if (request.reason !== MANUAL_DTR_REASON) return false;
      const selected = (request.selected_dates ?? []).map((day) => day.slice(0, 10));
      if (selected.some((day) => dates.has(day))) return true;
      return dates.has(request.start_date.slice(0, 10));
    })
    .map((request) => request.id);
  return { clockIds, overtimeIds, leaveIds };
}

export function manilaHm(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
