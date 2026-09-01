/**
 * Map office clock + timesheet rules into cutoff_hours buckets.
 * Aligns Reg hours with Time Attendance (base pay / Days Work), not raw clock sums.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseISO } from "date-fns";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import {
  generateTimesheetFromClockEntries,
  isSupervisoryOrManagerialJobLevel,
} from "@/lib/timesheet-auto-generator";
import {
  applyLeaveOverlayToAttendance,
  buildLeaveDatesMap,
  computeDaysWork,
  getSilCreditedDates,
  type LeaveRequestRow,
} from "@/lib/ph-payroll";

type OfficeEmployeeRow = {
  id: string;
  employee_code: string | null;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  daily_rate: number | null;
  per_day: number | null;
  directory_employee_id: string | null;
  employee_type?: string | null;
  position?: string | null;
  job_level?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
};

type ClockEntryRow = {
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status: string;
};

type HolidayRow = {
  holiday_date: string;
  holiday_type: string;
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function isSundayDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay() === 0;
}

function isHolidayDayType(dayType: string): boolean {
  return dayType.includes("holiday");
}

function isRestDayType(dayType: string): boolean {
  return dayType === "sunday" || dayType.includes("sunday");
}

export type OfficeCutoffHoursTotals = {
  actual_regular_hours: number;
  hours_work: number;
  overtime_hours: number;
  night_diff_hours: number;
  legal_holiday_hours: number;
  legal_holiday_ot_hours: number;
  special_holiday_hours: number;
  special_holiday_ot_hours: number;
  rest_day_hours: number;
  rest_day_ot_hours: number;
  pto_hours: number;
};

export function mapAttendanceToPremiumBuckets(
  attendanceData: Array<{
    date: string;
    dayType: string;
    regularHours?: number;
    overtimeHours?: number;
    nightDiffHours?: number;
  }>,
  entriesByDate: Map<string, ClockEntryRow[]>
): Omit<OfficeCutoffHoursTotals, "actual_regular_hours" | "hours_work" | "pto_hours"> {
  let overtime = 0;
  let nightDiff = 0;
  let legalHoliday = 0;
  let legalHolidayOt = 0;
  let specialHoliday = 0;
  let specialHolidayOt = 0;
  let restDay = 0;
  let restDayOt = 0;

  for (const day of attendanceData) {
    const ot = num(day.overtimeHours);
    const nd = num(day.nightDiffHours);
    const reg = num(day.regularHours);
    const dayType = day.dayType ?? "regular";
    const worked = (entriesByDate.get(day.date) ?? []).length > 0;

    overtime += ot;
    nightDiff += nd;

    if (dayType === "regular-holiday" || dayType === "sunday-regular-holiday") {
      if (worked) legalHoliday += reg;
      legalHolidayOt += ot;
    } else if (
      dayType === "non-working-holiday" ||
      dayType === "sunday-special-holiday"
    ) {
      if (worked) specialHoliday += reg;
      specialHolidayOt += ot;
    } else if (isRestDayType(dayType)) {
      if (worked) restDay += reg;
      restDayOt += ot;
    }
  }

  return {
    overtime_hours: overtime,
    night_diff_hours: nightDiff,
    legal_holiday_hours: legalHoliday,
    legal_holiday_ot_hours: legalHolidayOt,
    special_holiday_hours: specialHoliday,
    special_holiday_ot_hours: specialHolidayOt,
    rest_day_hours: restDay,
    rest_day_ot_hours: restDayOt,
  };
}

export function computeOfficeRegularHoursForCutoff(input: {
  periodStart: Date;
  periodEnd: Date;
  clockEntries: ClockEntryRow[];
  holidays: HolidayRow[];
  restDays?: Map<string, boolean>;
  leaveRows: LeaveRequestRow[];
  isClientBased: boolean;
  isAccountSupervisor: boolean;
  jobLevel?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  approvedOtByDate?: Map<string, number>;
}): OfficeCutoffHoursTotals {
  const periodStartStr = input.periodStart.toISOString().slice(0, 10);
  const periodEndStr = input.periodEnd.toISOString().slice(0, 10);

  const entriesByDate = new Map<string, ClockEntryRow[]>();
  for (const entry of input.clockEntries) {
    if (!entry.clock_out_time) continue;
    const workDate = dateOnly(entry.clock_in_time);
    const list = entriesByDate.get(workDate) ?? [];
    list.push(entry);
    entriesByDate.set(workDate, list);
  }

  const leaveDatesMap = buildLeaveDatesMap(
    input.leaveRows,
    periodStartStr,
    periodEndStr
  );

  const timesheetData = generateTimesheetFromClockEntries(
    input.clockEntries.map((entry, index) => ({
      ...entry,
      id: `${entry.employee_id}:${entry.clock_in_time}:${index}`,
    })),
    input.periodStart,
    input.periodEnd,
    input.holidays.map((h) => ({
      holiday_date: h.holiday_date,
      holiday_type: h.holiday_type,
    })),
    input.restDays,
    true,
    true,
    input.isClientBased && input.isAccountSupervisor,
    input.approvedOtByDate,
    undefined,
    input.isClientBased,
    isSupervisoryOrManagerialJobLevel(input.jobLevel)
  );

  const attendanceData = applyLeaveOverlayToAttendance(
    timesheetData.attendance_data as unknown as Array<Record<string, unknown>>,
    leaveDatesMap
  ) as unknown as typeof timesheetData.attendance_data;

  const premium = mapAttendanceToPremiumBuckets(attendanceData, entriesByDate);

  let hoursWork = 0;
  for (const entry of input.clockEntries) {
    if (!entry.clock_out_time) continue;
    hoursWork += num(entry.total_hours) || num(entry.regular_hours) + num(entry.overtime_hours);
  }

  const ptoHours = 0; // filled by caller from leave aggregation

  if (input.isClientBased) {
    const actualRegular = attendanceData.reduce(
      (sum, day) => sum + num(day.regularHours),
      0
    );
    return {
      actual_regular_hours: Math.round(actualRegular * 100) / 100,
      hours_work: hoursWork,
      pto_hours: ptoHours,
      ...premium,
    };
  }

  const clockEntriesForBasePay = input.clockEntries
    .filter((e) => e.clock_out_time)
    .map((e) => ({
      clock_in_time: e.clock_in_time,
      clock_out_time: e.clock_out_time!,
    }));

  const basePayResult = calculateBasePay({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    clockEntries: clockEntriesForBasePay,
    restDays: input.restDays,
    holidays: input.holidays.map((h) => ({ holiday_date: h.holiday_date })),
    creditedLeaveDates: getSilCreditedDates(leaveDatesMap),
    isClientBased: false,
    isAccountSupervisor: input.isAccountSupervisor,
    hireDate: input.hireDate ? parseISO(input.hireDate) : undefined,
    terminationDate: input.terminationDate
      ? parseISO(input.terminationDate)
      : undefined,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const actualTotalBH = attendanceData.reduce((sum, day) => {
    const dayDate = parseISO(day.date);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate > today) return sum;
    if (isRestDayType(day.dayType)) return sum;
    if (isHolidayDayType(day.dayType)) {
      const worked = (entriesByDate.get(day.date) ?? []).length > 0;
      if (!worked && num(day.regularHours) > 0) {
        return sum + num(day.regularHours);
      }
      return sum;
    }
    return sum + num(day.regularHours);
  }, 0);

  const renderedSpecialBH = attendanceData.reduce((sum, day) => {
    const dayDate = parseISO(day.date);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate > today) return sum;
    const worked = (entriesByDate.get(day.date) ?? []).length > 0;
    if (!worked) return sum;
    if (isRestDayType(day.dayType) || isHolidayDayType(day.dayType) || isSundayDate(day.date)) {
      return sum + num(day.regularHours);
    }
    return sum;
  }, 0);

  const daysWork = computeDaysWork({
    basePayHours: basePayResult.finalBaseHours,
    actualTotalBH,
    renderedSpecialBH,
    excludeWorkedSpecialDayFromDaysWork: false,
  });

  return {
    actual_regular_hours: daysWork.totalBHForDaysWork,
    hours_work: hoursWork,
    pto_hours: ptoHours,
    ...premium,
  };
}

export async function loadEmployeeSchedules(
  publicDb: SupabaseClient,
  employeeIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<Map<string, Map<string, boolean>>> {
  const byEmployee = new Map<string, Map<string, boolean>>();
  if (!employeeIds.length) return byEmployee;

  const { data: rows, error } = await publicDb
    .from("employee_week_schedules")
    .select("employee_id, schedule_date, day_off")
    .in("employee_id", employeeIds)
    .gte("schedule_date", periodStart)
    .lte("schedule_date", periodEnd);

  if (error) {
    console.warn("loadEmployeeSchedules:", error.message);
    return byEmployee;
  }

  for (const row of rows ?? []) {
    const empId = String(row.employee_id);
    if (!byEmployee.has(empId)) byEmployee.set(empId, new Map());
    if (row.day_off) {
      byEmployee.get(empId)!.set(String(row.schedule_date).slice(0, 10), true);
    }
  }
  return byEmployee;
}

export async function loadApprovedLeaveRows(
  publicDb: SupabaseClient,
  employeeIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<Map<string, LeaveRequestRow[]>> {
  const byEmployee = new Map<string, LeaveRequestRow[]>();
  if (!employeeIds.length) return byEmployee;

  const { data: leaveRows } = await publicDb
    .from("leave_requests")
    .select(
      "employee_id, leave_type, start_date, end_date, status, selected_dates, half_day_dates"
    )
    .in("employee_id", employeeIds)
    .lte("start_date", periodEnd)
    .gte("end_date", periodStart)
    .in("status", ["approved", "auto_approved", "approved_by_manager", "approved_by_hr"]);

  for (const row of leaveRows ?? []) {
    const empId = String((row as { employee_id: string }).employee_id);
    const list = byEmployee.get(empId) ?? [];
    list.push(row as LeaveRequestRow);
    byEmployee.set(empId, list);
  }
  return byEmployee;
}

export async function loadApprovedOtByEmployee(
  publicDb: SupabaseClient,
  employeeIds: string[],
  periodStart: string,
  periodEnd: string
): Promise<Map<string, Map<string, number>>> {
  const byEmployee = new Map<string, Map<string, number>>();
  if (!employeeIds.length) return byEmployee;

  const { data: otRows } = await publicDb
    .from("overtime_requests")
    .select("employee_id, total_hours, status, ot_date")
    .in("employee_id", employeeIds)
    .eq("status", "approved");

  for (const row of otRows ?? []) {
    const workDate = String((row as { ot_date?: string }).ot_date ?? "").slice(0, 10);
    if (!workDate || workDate < periodStart || workDate > periodEnd) continue;
    const empId = String((row as { employee_id: string }).employee_id);
    if (!byEmployee.has(empId)) byEmployee.set(empId, new Map());
    const map = byEmployee.get(empId)!;
    map.set(workDate, (map.get(workDate) ?? 0) + num((row as { total_hours?: number }).total_hours));
  }
  return byEmployee;
}
