/**
 * Automated Timesheet Generator
 *
 * Aggregates time clock entries into weekly_attendance format
 * This eliminates manual timesheet entry by auto-generating from time clock data
 */

import { format, parseISO, startOfDay, isWithinInterval } from "date-fns";
import { determineDayType, normalizeHolidays } from "@/utils/holidays";
import type { DailyAttendance } from "@/utils/payroll-calculator";

export interface TimeClockEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status: string;
}

export interface TimesheetGenerationResult {
  success: boolean;
  employee_id: string;
  period_start: string;
  period_end: string;
  days_generated: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
  errors?: string[];
}

/**
 * Generate timesheet data from time clock entries for a specific period
 */
export function generateTimesheetFromClockEntries(
  clockEntries: TimeClockEntry[],
  periodStart: Date,
  periodEnd: Date,
  holidays: Array<{ holiday_date: string; holiday_type: string }>,
  restDays?: Map<string, boolean>, // Map of date string to isRestDay boolean
  eligibleForOT: boolean = true, // Whether employee is eligible for overtime
  eligibleForNightDiff: boolean = true, // Whether employee is eligible for night differential (Account Supervisors have flexi time, so no night diff)
  isClientBasedAccountSupervisor: boolean = false // Whether employee is client-based Account Supervisor (for rest day logic)
): {
  attendance_data: DailyAttendance[];
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
} {
  // Group entries by date
  const entriesByDate = new Map<string, TimeClockEntry[]>();

  clockEntries.forEach((entry) => {
    if (!entry.clock_out_time) return; // Skip incomplete entries

    // Use Asia/Manila timezone for date grouping (same as timesheet page)
    // Convert UTC time to Asia/Manila timezone for correct date grouping
    const entryDateUTC = parseISO(entry.clock_in_time);
    // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(entryDateUTC);
    const entryDate = `${parts.find((p) => p.type === "year")!.value}-${
      parts.find((p) => p.type === "month")!.value
    }-${parts.find((p) => p.type === "day")!.value}`;
    
    if (!entriesByDate.has(entryDate)) {
      entriesByDate.set(entryDate, []);
    }
    entriesByDate.get(entryDate)!.push(entry);
  });

  // Generate daily attendance for each day in period
  const attendance_data: DailyAttendance[] = [];
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  let currentDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  // Pre-calculate all rest days for client-based Account Supervisors (for rest day logic)
  let allRestDaysSorted: string[] = [];
  if (isClientBasedAccountSupervisor && restDays && restDays.size > 0) {
    allRestDaysSorted = Array.from(restDays.keys())
      .filter(rd => {
        const rdDate = parseISO(rd);
        return rdDate >= periodStart && rdDate <= endDate;
      })
      .sort((a, b) => a.localeCompare(b)); // Sort chronologically
  }

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayEntries = entriesByDate.get(dateStr) || [];

    // Check if this date is a rest day from employee schedule
    const isRestDay = restDays?.get(dateStr);

    // Normalize holidays before determining day type
    const normalizedHolidays = normalizeHolidays(
      holidays.map((h) => ({
        date: h.holiday_date,
        name: "",
        type: h.holiday_type as "regular" | "non-working",
      }))
    );

    // Determine day type (regular, holiday, sunday/rest day, etc.)
    const dayType = determineDayType(dateStr, normalizedHolidays, isRestDay);

    // Aggregate hours from all entries for this day
    let regularHours = 0;
    let overtimeHours = 0;
    let nightDiffHours = 0;

    dayEntries.forEach((entry) => {
      // Only count approved or auto-approved entries
      if (
        entry.status === "approved" ||
        entry.status === "auto_approved" ||
        entry.status === "clocked_out"
      ) {
        regularHours += entry.regular_hours || 0;
        // Only count overtime if employee is eligible for OT
        if (eligibleForOT) {
          overtimeHours += entry.overtime_hours || 0;
        }
        // Only count night differential if employee is eligible (Account Supervisors have flexi time, so no night diff)
        if (eligibleForNightDiff) {
          nightDiffHours += entry.total_night_diff_hours || 0;
        }
      }
    });

    // Saturday Company Benefit: Set regularHours = 8 even if employee didn't work
    // Saturday is a company benefit - paid even if not worked, and counts towards days worked and total hours
    // This applies to ALL employees (office-based)
    if (dayType === "regular" && regularHours === 0) {
      const dateObj = parseISO(dateStr);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 6) {
        regularHours = 8; // Company benefit: 8 hours even if not worked
      }
    }

    // Client-based Account Supervisor Rest Day Logic:
    // They can mark any 2 days as rest days in their schedule (often weekdays since hotels are busy Fri-Sun)
    // Rest days that fall on holidays are treated as holidays (handled by determineDayType)
    // Only 1 rest day gets paid at regular rate (like Saturday for office-based) - the FIRST rest day chronologically
    // The second rest day only gets paid if worked (like Sunday for office-based)
    // Rest days can be on any weekday - they often work Sat/Sun due to hotel peak days
    if (isClientBasedAccountSupervisor && isRestDay && regularHours === 0 && dayType === "sunday") {
      // Only apply rest day pay logic if dayType is "sunday" (meaning it's a rest day, not a holiday)
      // First rest day (chronologically) = treated like Saturday (paid even if not worked)
      // Second rest day (chronologically) = treated like Sunday (only paid if worked)
      if (allRestDaysSorted.length >= 1 && dateStr === allRestDaysSorted[0]) {
        // First rest day: Paid even if not worked (like Saturday)
        regularHours = 8;
      }
      // Second rest day (and beyond): Only paid if worked (keep regularHours = 0)
      // Note: If they worked on the second rest day, regularHours will already be > 0 from entries above
    }
    // If rest day falls on holiday, dayType will be "sunday-regular-holiday" or "sunday-special-holiday"
    // and it will be handled by the holiday logic below

    // Sunday Rest Day: DO NOT automatically set regularHours = 8
    // For Rank and File: They get paid 8 hours even if not worked (handled in payslip calculation)
    // For Account Supervisors/Supervisory: They only get paid if they actually worked (regularHours > 0)
    // The payslip calculation will handle the payment logic based on employee type
    // We keep regularHours = 0 if they didn't work, so the payslip can check if they actually worked

    // Holidays: Set regularHours = 8 if employee is eligible (worked REGULAR WORKING DAY before) even if didn't work on holiday
    // Check "1 Day Before" rule for holidays - must be a REGULAR WORKING DAY (not a holiday or rest day)
    // Eligible holidays count towards "Days Work" and "Hours Worked"
    if (
      (dayType === "regular-holiday" || dayType === "non-working-holiday") &&
      regularHours === 0
    ) {
      // Search up to 7 days back to find the last REGULAR WORKING DAY (skip holidays and rest days)
      // This matches the payslip calculation logic
      const dateObj = parseISO(dateStr);
      let foundRegularWorkingDay = false;

      for (let i = 1; i <= 7; i++) {
        const checkDateObj = new Date(dateObj);
        checkDateObj.setDate(checkDateObj.getDate() - i);
        const checkDateStr = format(checkDateObj, "yyyy-MM-dd");

        // Check if this date is a regular working day (not a holiday or rest day)
        const normalizedHolidays = normalizeHolidays(
          holidays.map((h) => ({
            date: h.holiday_date,
            name: "",
            type: h.holiday_type as "regular" | "non-working",
          }))
        );
        const checkDayType = determineDayType(checkDateStr, normalizedHolidays);

        // Only check regular working days (skip holidays and rest days)
        if (checkDayType === "regular") {
          // Check if employee worked this regular working day (has entry with regular_hours >= 8)
          // Use Asia/Manila timezone for date comparison (same as timesheet page)
          const checkDayEntry = clockEntries.find((entry) => {
            const entryDateUTC = parseISO(entry.clock_in_time);
            // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            const parts = formatter.formatToParts(entryDateUTC);
            const entryDateStr = `${parts.find((p) => p.type === "year")!.value}-${
              parts.find((p) => p.type === "month")!.value
            }-${parts.find((p) => p.type === "day")!.value}`;
            return (
              entryDateStr === checkDateStr &&
              (entry.status === "approved" ||
                entry.status === "auto_approved" ||
                entry.status === "clocked_out") &&
              (entry.regular_hours || 0) >= 8
            );
          });

          if (checkDayEntry) {
            foundRegularWorkingDay = true;
            break; // Found the immediately preceding regular working day with 8+ hours
          }
        }
        // If it's a holiday or rest day, continue searching backwards
      }

      if (foundRegularWorkingDay) {
        regularHours = 8; // Eligible holiday: 8 hours even if not worked
      }
    }

    // Floor down hours (round down to full hours only, matching database trigger)
    attendance_data.push({
      date: dateStr,
      dayType: dayType as any,
      regularHours: Math.floor(regularHours),
      overtimeHours: Math.floor(overtimeHours),
      nightDiffHours: Math.floor(nightDiffHours),
    });

    // Move to next day
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate totals (already floored in individual days, but ensure totals are also floored)
  const total_regular_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.regularHours, 0)
  );
  const total_overtime_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.overtimeHours, 0)
  );
  const total_night_diff_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.nightDiffHours, 0)
  );

  return {
    attendance_data,
    total_regular_hours,
    total_overtime_hours,
    total_night_diff_hours,
  };
}

/**
 * Validate that all required time clock entries exist for a period
 */
export function validateClockEntries(
  clockEntries: TimeClockEntry[],
  periodStart: Date,
  periodEnd: Date,
  expectedWorkingDays: number[]
): {
  isValid: boolean;
  missingDays: string[];
  incompleteEntries: string[];
} {
  const missingDays: string[] = [];
  const incompleteEntries: string[] = [];

  const entriesByDate = new Map<string, TimeClockEntry[]>();
  clockEntries.forEach((entry) => {
    const dateStr = format(parseISO(entry.clock_in_time), "yyyy-MM-dd");
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  });

  // Check for missing days (only check expected working days)
  expectedWorkingDays.forEach((dayOfWeek) => {
    let currentDate = new Date(periodStart);
    while (currentDate <= periodEnd) {
      if (currentDate.getDay() === dayOfWeek) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const dayEntries = entriesByDate.get(dateStr) || [];

        // Check if there's at least one complete entry
        const hasCompleteEntry = dayEntries.some(
          (entry) =>
            entry.clock_out_time !== null &&
            (entry.status === "approved" ||
              entry.status === "auto_approved" ||
              entry.status === "clocked_out")
        );

        if (!hasCompleteEntry && dayEntries.length > 0) {
          incompleteEntries.push(dateStr);
        } else if (!hasCompleteEntry) {
          missingDays.push(dateStr);
        }
      }
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  return {
    isValid: missingDays.length === 0 && incompleteEntries.length === 0,
    missingDays,
    incompleteEntries,
  };
}
