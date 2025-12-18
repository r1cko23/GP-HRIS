"use client";

import { memo, useMemo } from "react";
import { formatCurrency } from "@/utils/format";
import {
  calculateRegularOT,
  calculateNightDiff,
  calculateRegularHoliday,
  calculateRegularHolidayOT,
  calculateNonWorkingHoliday,
  calculateNonWorkingHolidayOT,
  calculateSundayRestDay,
  calculateSundayRestDayOT,
  calculateSundaySpecialHoliday,
  calculateSundaySpecialHolidayOT,
  calculateSundayRegularHoliday,
  calculateSundayRegularHolidayOT,
  type DayType,
} from "@/utils/payroll-calculator";

interface PayslipDetailedBreakdownProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day: number;
    rate_per_hour: number;
    position?: string | null;
  };
  attendanceData: Array<{
    date: string;
    dayType: DayType;
    regularHours: number;
    overtimeHours: number;
    nightDiffHours: number;
    clockInTime?: string;
    clockOutTime?: string;
  }>;
}

function PayslipDetailedBreakdownComponent({
  employee,
  attendanceData,
}: PayslipDetailedBreakdownProps) {
  const ratePerHour = employee.rate_per_hour;
  const ratePerDay = employee.rate_per_day;

  // Helper function to calculate hours from clock times
  function calculateHoursFromClockTimes(
    clockInTime: string | undefined,
    clockOutTime: string | undefined,
    date: string
  ): {
    regularHours: number;
    nightDiffHours: number;
    totalHours: number;
  } {
    if (!clockInTime || !clockOutTime) {
      return { regularHours: 0, nightDiffHours: 0, totalHours: 0 };
    }

    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    const workDate = new Date(date);

    // Regular work hours: 8AM (08:00) to 5PM (17:00) = 8 hours
    const regularStart = new Date(workDate);
    regularStart.setHours(8, 0, 0, 0);
    const regularEnd = new Date(workDate);
    regularEnd.setHours(17, 0, 0, 0);

    // Calculate total hours worked
    const totalMs = clockOut.getTime() - clockIn.getTime();
    const totalHours = totalMs / (1000 * 60 * 60);

    // Calculate regular hours (8AM-5PM, capped at 8 hours)
    const regularStartMs = Math.max(clockIn.getTime(), regularStart.getTime());
    const regularEndMs = Math.min(clockOut.getTime(), regularEnd.getTime());
    const regularHoursMs = Math.max(0, regularEndMs - regularStartMs);
    let regularHours = Math.min(regularHoursMs / (1000 * 60 * 60), 8);

    // Calculate night differential hours (after 5PM = 17:00)
    // Night diff starts at 5PM and continues until 6AM next day
    let nightDiffHours = 0;

    // Same day: hours after 5PM
    if (clockOut.getDate() === clockIn.getDate()) {
      const nightDiffStart = new Date(workDate);
      nightDiffStart.setHours(17, 0, 0, 0); // 5PM

      if (clockOut.getTime() > nightDiffStart.getTime()) {
        const nightStartMs = Math.max(
          clockIn.getTime(),
          nightDiffStart.getTime()
        );
        const nightEndMs = clockOut.getTime();
        nightDiffHours = Math.max(
          0,
          (nightEndMs - nightStartMs) / (1000 * 60 * 60)
        );
      }
    } else {
      // Work spans midnight
      // Hours from 5PM to midnight on first day
      const nightDiffStart = new Date(clockIn);
      nightDiffStart.setHours(17, 0, 0, 0); // 5PM
      const dayEnd = new Date(clockIn);
      dayEnd.setHours(23, 59, 59, 999);

      if (clockIn.getTime() < dayEnd.getTime()) {
        const firstDayNightStart = Math.max(
          clockIn.getTime(),
          nightDiffStart.getTime()
        );
        const firstDayNightEnd = Math.min(clockOut.getTime(), dayEnd.getTime());
        nightDiffHours += Math.max(
          0,
          (firstDayNightEnd - firstDayNightStart) / (1000 * 60 * 60)
        );
      }

      // Hours from midnight to 6AM on next day
      const nextDayStart = new Date(clockOut);
      nextDayStart.setHours(0, 0, 0, 0);
      const nextDayEnd = new Date(clockOut);
      nextDayEnd.setHours(6, 0, 0, 0);

      if (clockOut.getTime() > nextDayStart.getTime()) {
        const nextDayNightStart = Math.max(
          clockIn.getTime(),
          nextDayStart.getTime()
        );
        const nextDayNightEnd = Math.min(
          clockOut.getTime(),
          nextDayEnd.getTime()
        );
        nightDiffHours += Math.max(
          0,
          (nextDayNightEnd - nextDayNightStart) / (1000 * 60 * 60)
        );
      }
    }

    return {
      regularHours: Math.round(regularHours * 100) / 100,
      nightDiffHours: Math.round(nightDiffHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }

  // Calculate breakdown from attendance data
  let totalHours = 0; // Total hours including all day types (regular + rest days + holidays)
  let daysWorked = 0; // Total days worked (regular + rest days, excluding holidays)
  let basicSalary = 0; // Basic salary from regular days only
  let totalRegularHours = 0;

  const breakdown = {
    regularOvertime: { hours: 0, amount: 0 },
    nightDifferential: { hours: 0, amount: 0 },
    legalHoliday: { hours: 0, amount: 0 },
    legalHolidayOT: { hours: 0, amount: 0 },
    legalHolidayND: { hours: 0, amount: 0 },
    specialHoliday: { hours: 0, amount: 0 },
    shOT: { hours: 0, amount: 0 },
    shNightDiff: { hours: 0, amount: 0 },
    shOnRDOT: { hours: 0, amount: 0 },
    lhOnRDOT: { hours: 0, amount: 0 },
    restDay: { hours: 0, amount: 0 },
    restDayOT: { hours: 0, amount: 0 },
    restDayNightDiff: { hours: 0, amount: 0 },
    workingDayoff: { hours: 0, amount: 0 },
    regularNightdiffOT: { hours: 0, amount: 0 },
  };

  attendanceData.forEach((day) => {
    const {
      dayType,
      regularHours: dayRegularHours,
      overtimeHours,
      nightDiffHours: dayNightDiffHours,
      clockInTime,
      clockOutTime,
      date,
    } = day;

    // Calculate hours from clock times if available, otherwise use provided values
    let regularHours = dayRegularHours;
    let nightDiffHours = dayNightDiffHours;

    // IMPORTANT: If regularHours is already 8 (e.g., for leave days), don't recalculate from clock times
    // This ensures leave days with BH = 8 are counted correctly even if they have clock times
    const isLeaveDayWithFullHours = (dayRegularHours || 0) >= 8;

    if (clockInTime && clockOutTime && !isLeaveDayWithFullHours) {
      // Only recalculate regular hours from clock times if needed
      // IMPORTANT: Night differential should come from approved OT requests only, NOT from clock times
      // The nightDiffHours from attendance_data already comes from approved OT requests (via timesheet generator)
      const calculated = calculateHoursFromClockTimes(
        clockInTime,
        clockOutTime,
        date
      );
      regularHours = calculated.regularHours;
      // DO NOT override nightDiffHours - it should come from approved OT requests only
      // nightDiffHours remains as dayNightDiffHours (from approved OT requests)
      totalHours += calculated.totalHours;
    } else {
      totalHours += regularHours + overtimeHours;
    }

    // Count days worked and calculate basic salary
    // Days with regularHours >= 8 count as 1 working day (matches timesheet logic where BH = 8 = 1 day)
    // IMPORTANT:
    // - "Days Work" = ALL days worked (regular + rest days, excluding holidays)
    // - Basic Salary = ONLY regular days (rest days and holidays paid separately)
    // - Rest days count in "Days Work" but are paid with premium separately

    // Count all days with 8+ hours as working days (including rest days, excluding holidays)
    if (regularHours >= 8) {
      // Count rest days and regular days as "Days Work" (but not holidays)
      if (
        dayType === "regular" ||
        dayType === "sunday" ||
        dayType === "sunday-special-holiday" ||
        dayType === "sunday-regular-holiday"
      ) {
        daysWorked++;
      }

      totalRegularHours += regularHours;

      // Only add to basic salary if it's a regular day
      // Rest days and holidays are paid separately with premium
      if (dayType === "regular") {
        // Basic salary = regular hours × hourly rate
        // This represents the base pay for regular working hours (8AM-5PM)
        basicSalary += regularHours * ratePerHour;
      }
    } else if (regularHours > 0 && dayType === "regular") {
      // Partial days (< 8 hours) on regular days still count towards total hours and basic salary
      // but don't count as a full working day
      totalRegularHours += regularHours;
      basicSalary += regularHours * ratePerHour;
    }

    // Regular Overtime
    if (dayType === "regular" && overtimeHours > 0) {
      breakdown.regularOvertime.hours += overtimeHours;
      breakdown.regularOvertime.amount += calculateRegularOT(
        overtimeHours,
        ratePerHour
      );
    }

    // Night Differential (regular days only - holidays and rest days have separate ND calculations)
    // Account Supervisors have flexi time, so they should not have night differential
    const isAccountSupervisor =
      employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
    // Only count night differential for regular days
    // Holidays and rest days have their own separate night differential calculations
    if (dayType === "regular" && nightDiffHours > 0 && !isAccountSupervisor) {
      breakdown.nightDifferential.hours += nightDiffHours;
      breakdown.nightDifferential.amount += calculateNightDiff(
        nightDiffHours,
        ratePerHour
      );
    }

    // Legal Holiday (regular-holiday)
    if (dayType === "regular-holiday") {
      breakdown.legalHoliday.hours += regularHours;
      breakdown.legalHoliday.amount += calculateRegularHoliday(
        regularHours,
        ratePerHour
      );

      if (overtimeHours > 0) {
        breakdown.legalHolidayOT.hours += overtimeHours;
        breakdown.legalHolidayOT.amount += calculateRegularHolidayOT(
          overtimeHours,
          ratePerHour
        );
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.legalHolidayND.hours += nightDiffHours;
        breakdown.legalHolidayND.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Special Holiday (non-working-holiday)
    if (dayType === "non-working-holiday") {
      breakdown.specialHoliday.hours += regularHours;
      breakdown.specialHoliday.amount += calculateNonWorkingHoliday(
        regularHours,
        ratePerHour
      );

      if (overtimeHours > 0) {
        breakdown.shOT.hours += overtimeHours;
        breakdown.shOT.amount += calculateNonWorkingHolidayOT(
          overtimeHours,
          ratePerHour
        );
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.shNightDiff.hours += nightDiffHours;
        breakdown.shNightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Sunday/Rest Day
    if (dayType === "sunday") {
      breakdown.restDay.hours += regularHours;
      breakdown.restDay.amount += calculateSundayRestDay(
        regularHours,
        ratePerHour
      );

      if (overtimeHours > 0) {
        breakdown.restDayOT.hours += overtimeHours;
        breakdown.restDayOT.amount += calculateSundayRestDayOT(
          overtimeHours,
          ratePerHour
        );
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.restDayNightDiff.hours += nightDiffHours;
        breakdown.restDayNightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Sunday + Special Holiday
    if (dayType === "sunday-special-holiday") {
      breakdown.specialHoliday.hours += regularHours;
      breakdown.specialHoliday.amount += calculateSundaySpecialHoliday(
        regularHours,
        ratePerHour
      );

      if (overtimeHours > 0) {
        breakdown.shOnRDOT.hours += overtimeHours;
        breakdown.shOnRDOT.amount += calculateSundaySpecialHolidayOT(
          overtimeHours,
          ratePerHour
        );
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.shNightDiff.hours += nightDiffHours;
        breakdown.shNightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Sunday + Regular Holiday
    if (dayType === "sunday-regular-holiday") {
      breakdown.legalHoliday.hours += regularHours;
      breakdown.legalHoliday.amount += calculateSundayRegularHoliday(
        regularHours,
        ratePerHour
      );

      if (overtimeHours > 0) {
        breakdown.lhOnRDOT.hours += overtimeHours;
        breakdown.lhOnRDOT.amount += calculateSundayRegularHolidayOT(
          overtimeHours,
          ratePerHour
        );
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.legalHolidayND.hours += nightDiffHours;
        breakdown.legalHolidayND.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Regular Nightdiff OT (regular day with OT and night diff) - Account Supervisors have flexi time, so no night diff
    if (
      dayType === "regular" &&
      overtimeHours > 0 &&
      nightDiffHours > 0 &&
      !isAccountSupervisor
    ) {
      breakdown.regularNightdiffOT.hours += Math.min(
        overtimeHours,
        nightDiffHours
      );
      breakdown.regularNightdiffOT.amount += calculateNightDiff(
        Math.min(overtimeHours, nightDiffHours),
        ratePerHour
      );
    }
  });

  const totalSalary = basicSalary;

  return (
    <div className="w-full">
      {/* Employee Name - Compact */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {employee.full_name}
        </h3>
      </div>

      {/* Basic Earning(s) Section - Compact */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold mb-2 text-gray-800">
          Basic Earning(s)
        </h4>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">
                    Days Work
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Daily Rate
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Hourly Rate
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Basic Salary
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Total Salary
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                    {daysWorked}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                    {formatCurrency(ratePerDay)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono text-gray-700">
                    {ratePerHour.toFixed(3)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                    {formatCurrency(basicSalary)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-bold text-primary-700">
                    {formatCurrency(
                      basicSalary +
                        breakdown.regularOvertime.amount +
                        breakdown.nightDifferential.amount +
                        breakdown.legalHoliday.amount +
                        breakdown.legalHolidayOT.amount +
                        breakdown.legalHolidayND.amount +
                        breakdown.specialHoliday.amount +
                        breakdown.shOT.amount +
                        breakdown.shNightDiff.amount +
                        breakdown.shOnRDOT.amount +
                        breakdown.lhOnRDOT.amount +
                        breakdown.restDay.amount +
                        breakdown.restDayOT.amount +
                        breakdown.restDayNightDiff.amount +
                        breakdown.workingDayoff.amount +
                        breakdown.regularNightdiffOT.amount
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overtimes/Holiday Earning(s) Section - Compact */}
      <div className="mt-3">
        <h4 className="text-sm font-semibold mb-2 text-gray-800">
          Overtimes/Holiday Earning(s)
        </h4>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">
                    Component
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    #Hours
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    OT Rate
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Helper function to render earning row */}
                {(() => {
                  const renderEarningRow = (
                    label: string,
                    hours: number,
                    rate: number | string,
                    amount: number,
                    showCalculation: boolean = false
                  ) => {
                    const hoursValue = hours.toFixed(2);
                    const amountValue = amount;
                    const rateDisplay =
                      typeof rate === "number" ? rate.toFixed(2) : rate;
                    const hasValue = hours > 0 || amount > 0;

                    return (
                      <tr
                        className={`transition-colors ${
                          hasValue
                            ? "bg-white hover:bg-gray-50"
                            : "bg-gray-50/50 opacity-60"
                        }`}
                      >
                        <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                          {label}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right text-gray-700 font-mono">
                          {hoursValue}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {showCalculation && hasValue ? (
                            <span className="inline-flex items-center gap-0.5 text-gray-600">
                              <span className="font-mono">{hoursValue}</span>
                              <span className="text-gray-400">×</span>
                              <span className="font-semibold text-primary-600">
                                {rateDisplay}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-500">{rateDisplay}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                          {formatCurrency(amountValue)}
                        </td>
                      </tr>
                    );
                  };

                  return (
                    <>
                      {/* Hours Work - Total hours worked (including rest days, excluding holidays) */}
                      {renderEarningRow("1. Hours Work", totalHours, "—", 0)}

                      {/* Regular Overtime */}
                      {renderEarningRow(
                        "2. Regular Overtime",
                        breakdown.regularOvertime.hours,
                        1.25,
                        breakdown.regularOvertime.amount,
                        true
                      )}

                      {/* Night Differential */}
                      {renderEarningRow(
                        "3. Night Differential",
                        breakdown.nightDifferential.hours,
                        0.1,
                        breakdown.nightDifferential.amount,
                        true
                      )}

                      {/* Legal Holiday */}
                      {renderEarningRow(
                        "4. Legal Holiday",
                        breakdown.legalHoliday.hours,
                        1,
                        breakdown.legalHoliday.amount,
                        true
                      )}

                      {/* Legal Holiday OT */}
                      {renderEarningRow(
                        "5. Legal Holiday OT",
                        breakdown.legalHolidayOT.hours,
                        2.6,
                        breakdown.legalHolidayOT.amount,
                        true
                      )}

                      {/* Legal Holiday ND */}
                      {renderEarningRow(
                        "6. Legal Holiday ND",
                        breakdown.legalHolidayND.hours,
                        0.1,
                        breakdown.legalHolidayND.amount,
                        true
                      )}

                      {/* Special Holiday */}
                      {renderEarningRow(
                        "7. Special Holiday",
                        breakdown.specialHoliday.hours,
                        0.3,
                        breakdown.specialHoliday.amount,
                        true
                      )}

                      {/* SH OT */}
                      {renderEarningRow(
                        "8. Special Holiday OT",
                        breakdown.shOT.hours,
                        1.69,
                        breakdown.shOT.amount,
                        true
                      )}

                      {/* SH Night Diff */}
                      {renderEarningRow(
                        "9. Special Holiday ND",
                        breakdown.shNightDiff.hours,
                        0.1,
                        breakdown.shNightDiff.amount,
                        true
                      )}

                      {/* SH on RD OT */}
                      {renderEarningRow(
                        "10. Special Holiday on Rest Day OT",
                        breakdown.shOnRDOT.hours,
                        1.95,
                        breakdown.shOnRDOT.amount,
                        true
                      )}

                      {/* LH on RD OT */}
                      {renderEarningRow(
                        "11. Legal Holiday on Rest Day OT",
                        breakdown.lhOnRDOT.hours,
                        3.38,
                        breakdown.lhOnRDOT.amount,
                        true
                      )}

                      {/* Rest Day */}
                      {renderEarningRow(
                        "12. Rest Day",
                        breakdown.restDay.hours,
                        0.3,
                        breakdown.restDay.amount,
                        true
                      )}

                      {/* Rest Day OT */}
                      {renderEarningRow(
                        "13. Rest Day OT",
                        breakdown.restDayOT.hours,
                        1.69,
                        breakdown.restDayOT.amount,
                        true
                      )}

                      {/* Rest Day Night Diff */}
                      {renderEarningRow(
                        "14. Rest Day ND",
                        breakdown.restDayNightDiff.hours,
                        0.1,
                        breakdown.restDayNightDiff.amount,
                        true
                      )}

                      {/* Working Dayoff */}
                      {renderEarningRow(
                        "15. Working Day Off",
                        breakdown.workingDayoff.hours,
                        1.3,
                        breakdown.workingDayoff.amount,
                        true
                      )}

                      {/* Regular Nightdiff OT */}
                      {renderEarningRow(
                        "16. Regular Night Differential OT",
                        breakdown.regularNightdiffOT.hours,
                        0.1,
                        breakdown.regularNightdiffOT.amount,
                        true
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Summary Footer - Compact */}
          <div className="bg-gray-50 border-t border-gray-200 px-2 py-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">
                Total Earnings:
              </span>
              <span className="text-sm font-bold text-primary-700">
                {formatCurrency(
                  breakdown.regularOvertime.amount +
                    breakdown.nightDifferential.amount +
                    breakdown.legalHoliday.amount +
                    breakdown.legalHolidayOT.amount +
                    breakdown.legalHolidayND.amount +
                    breakdown.specialHoliday.amount +
                    breakdown.shOT.amount +
                    breakdown.shNightDiff.amount +
                    breakdown.shOnRDOT.amount +
                    breakdown.lhOnRDOT.amount +
                    breakdown.restDay.amount +
                    breakdown.restDayOT.amount +
                    breakdown.restDayNightDiff.amount +
                    breakdown.workingDayoff.amount +
                    breakdown.regularNightdiffOT.amount
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent expensive recalculations on parent re-renders
export const PayslipDetailedBreakdown = memo(PayslipDetailedBreakdownComponent);
