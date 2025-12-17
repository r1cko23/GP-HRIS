"use client";

import { memo, useMemo } from "react";
import { format } from "date-fns";
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

interface PayslipPrintProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day?: number;
    rate_per_hour?: number;
    position?: string | null;
    assigned_hotel?: string | null;
  };
  weekStart: Date;
  weekEnd: Date;
  attendance: any;
  earnings: {
    regularPay: number;
    regularOT: number;
    regularOTHours: number;
    nightDiff: number;
    nightDiffHours: number;
    sundayRestDay: number;
    sundayRestDayHours: number;
    specialHoliday: number;
    specialHolidayHours: number;
    regularHoliday: number;
    regularHolidayHours: number;
    grossIncome: number;
  };
  deductions: {
    vale: number;
    uniformPPE: number;
    sssLoan: number;
    sssCalamityLoan: number;
    pagibigLoan: number;
    pagibigCalamityLoan: number;
    sssContribution: number;
    philhealthContribution: number;
    pagibigContribution: number;
    withholdingTax?: number;
    totalDeductions: number;
  };
  adjustment: number;
  netPay: number;
  workingDays: number;
  absentDays: number;
  preparedBy: string;
}

function PayslipPrintComponent(props: PayslipPrintProps) {
  const {
    employee,
    weekStart,
    weekEnd,
    attendance,
    deductions,
    netPay,
    workingDays,
    preparedBy,
  } = props;

  // Calculate detailed earnings breakdown from attendance data
  const ratePerHour = employee.rate_per_hour || 0;
  const ratePerDay = employee.rate_per_day || 0;

  // Account Supervisors have flexi time, so they should not have night differential
  const isAccountSupervisor =
    employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;

  // Initialize earnings breakdown
  const earningsBreakdown = {
    basic: { days: 0, amount: 0 },
    overtime: { hours: 0, amount: 0 },
    nightDiff: { hours: 0, amount: 0 },
    legalHoliday: { days: 0, amount: 0 },
    legalHDOT: { hours: 0, amount: 0 },
    legalHDND: { hours: 0, amount: 0 },
    spHoliday: { days: 0, amount: 0 },
    SHOT: { hours: 0, amount: 0 },
    SHND: { hours: 0, amount: 0 },
    SHonRDOT: { hours: 0, amount: 0 },
    LHonRDOT: { hours: 0, amount: 0 },
    NDOT: { hours: 0, amount: 0 },
    restDay: { days: 0, amount: 0 },
    restDayOT: { hours: 0, amount: 0 },
    restDayND: { hours: 0, amount: 0 },
    workingDayoff: { days: 0, amount: 0 },
    otherPay: { amount: 0 },
  };

  let totalSalary = 0;
  let totalGrossPay = 0;

  // Process attendance data if available
  if (
    attendance?.attendance_data &&
    Array.isArray(attendance.attendance_data)
  ) {
    const attendanceData = attendance.attendance_data as Array<{
      date: string;
      dayType?: DayType;
      regularHours: number;
      overtimeHours: number;
      nightDiffHours: number;
    }>;

    attendanceData.forEach((day) => {
      const {
        dayType = "regular",
        regularHours,
        overtimeHours,
        nightDiffHours,
      } = day;

      // Basic salary (regular working days)
      if (dayType === "regular" && regularHours > 0) {
        earningsBreakdown.basic.days++;
        const dayAmount = regularHours * ratePerHour;
        earningsBreakdown.basic.amount += dayAmount;
        totalSalary += dayAmount;
      }

      // Regular Overtime
      if (dayType === "regular" && overtimeHours > 0) {
        earningsBreakdown.overtime.hours += overtimeHours;
        earningsBreakdown.overtime.amount += calculateRegularOT(
          overtimeHours,
          ratePerHour
        );
      }

      // Night Differential (regular days) - Account Supervisors have flexi time, so no night diff
      if (dayType === "regular" && nightDiffHours > 0 && !isAccountSupervisor) {
        earningsBreakdown.nightDiff.hours += nightDiffHours;
        earningsBreakdown.nightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }

      // NDOT (Night Diff OT on regular days) - Account Supervisors have flexi time, so no night diff
      if (
        dayType === "regular" &&
        overtimeHours > 0 &&
        nightDiffHours > 0 &&
        !isAccountSupervisor
      ) {
        const ndotHours = Math.min(overtimeHours, nightDiffHours);
        earningsBreakdown.NDOT.hours += ndotHours;
        earningsBreakdown.NDOT.amount += calculateNightDiff(
          ndotHours,
          ratePerHour
        );
      }

      // Legal Holiday
      if (dayType === "regular-holiday") {
        if (regularHours > 0) {
          earningsBreakdown.legalHoliday.days++;
          earningsBreakdown.legalHoliday.amount += calculateRegularHoliday(
            regularHours,
            ratePerHour
          );
        }
        if (overtimeHours > 0) {
          earningsBreakdown.legalHDOT.hours += overtimeHours;
          earningsBreakdown.legalHDOT.amount += calculateRegularHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.legalHDND.hours += nightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Special Holiday
      if (dayType === "non-working-holiday") {
        if (regularHours > 0) {
          earningsBreakdown.spHoliday.days++;
          earningsBreakdown.spHoliday.amount += calculateNonWorkingHoliday(
            regularHours,
            ratePerHour
          );
        }
        if (overtimeHours > 0) {
          earningsBreakdown.SHOT.hours += overtimeHours;
          earningsBreakdown.SHOT.amount += calculateNonWorkingHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.SHND.hours += nightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Rest Day (Sunday)
      if (dayType === "sunday") {
        if (regularHours > 0) {
          earningsBreakdown.restDay.days++;
          earningsBreakdown.restDay.amount += calculateSundayRestDay(
            regularHours,
            ratePerHour
          );
        }
        if (overtimeHours > 0) {
          earningsBreakdown.restDayOT.hours += overtimeHours;
          earningsBreakdown.restDayOT.amount += calculateSundayRestDayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.restDayND.hours += nightDiffHours;
          earningsBreakdown.restDayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Special Holiday
      if (dayType === "sunday-special-holiday") {
        if (regularHours > 0) {
          // Regular hours on Sunday + Special Holiday are included in SHonRDOT calculation
          // No separate row needed
        }
        if (overtimeHours > 0) {
          earningsBreakdown.SHonRDOT.hours += overtimeHours;
          earningsBreakdown.SHonRDOT.amount += calculateSundaySpecialHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.SHND.hours += nightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Regular Holiday
      if (dayType === "sunday-regular-holiday") {
        if (regularHours > 0) {
          // Regular hours on Sunday + Regular Holiday are included in LHonRDOT calculation
          // No separate row needed
        }
        if (overtimeHours > 0) {
          earningsBreakdown.LHonRDOT.hours += overtimeHours;
          earningsBreakdown.LHonRDOT.amount += calculateSundayRegularHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.legalHDND.hours += nightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    });

    // Calculate total gross pay (sum of all earnings)
    totalGrossPay = Object.values(earningsBreakdown).reduce((sum, item) => {
      if (typeof item === "object" && "amount" in item) {
        return sum + (item.amount || 0);
      }
      return sum;
    }, 0);

    // Total Salary should equal Basic amount (as shown in sample)
    totalSalary = earningsBreakdown.basic.amount;
  } else {
    // Fallback to provided earnings
    totalSalary = props.earnings.regularPay;
    totalGrossPay = props.earnings.grossIncome || props.earnings.regularPay;
    earningsBreakdown.basic.days = workingDays;
    earningsBreakdown.basic.amount = props.earnings.regularPay;
    earningsBreakdown.overtime.hours = props.earnings.regularOTHours;
    earningsBreakdown.overtime.amount = props.earnings.regularOT;
    earningsBreakdown.nightDiff.hours = props.earnings.nightDiffHours;
    earningsBreakdown.nightDiff.amount = props.earnings.nightDiff;
  }

  // Format name (LAST NAME, FIRST NAME)
  const formatName = (fullName: string) => {
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(" ");
      return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}`;
    }
    return fullName.toUpperCase();
  };

  // Format period (MM/DD/YYYY to MM/DD/YYYY)
  const formatPeriod = (start: Date, end: Date) => {
    return `${format(start, "MM/dd/yyyy")} to ${format(end, "MM/dd/yyyy")}`;
  };

  // Format number with dash for zero
  const formatNumber = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num === 0 ? "-" : num.toFixed(2);
  };

  // Format currency with dash for zero
  const formatCurrencyOrDash = (value: number) => {
    return value === 0 ? "-" : formatCurrency(value);
  };

  // Calculate total deductions
  // Note: withholdingTax is already included in deductions.totalDeductions from props
  const totalDeductions = deductions.totalDeductions;
  const tardiness = 0; // Can be calculated later if needed

  // Ensure Total Salary equals Basic amount (for display consistency with sample)
  if (totalSalary === 0 && earningsBreakdown.basic.amount > 0) {
    totalSalary = earningsBreakdown.basic.amount;
  }

  // Total Gross Pay = Total Salary - Tardiness (as shown in sample)
  // If we have calculated earnings, use that; otherwise use Total Salary
  if (totalGrossPay === 0) {
    totalGrossPay = totalSalary - tardiness;
  } else {
    // If we have calculated totalGrossPay from all earnings, use that
    // But ensure it's at least Total Salary
    totalGrossPay = Math.max(totalGrossPay, totalSalary - tardiness);
  }

  return (
    <div
      id="payslip-print-content"
      className="payslip-container"
      style={{
        width: "8.5in",
        padding: "0.5in",
        backgroundColor: "#fff",
        color: "#000",
        fontFamily: "Arial, sans-serif",
        fontSize: "10pt",
        lineHeight: "1.2",
      }}
    >
      {/* Header with Logo - Enlarged */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "10px",
          borderBottom: "2px solid #000",
          paddingBottom: "10px",
        }}
      >
        <img
          src="/gp-logo.webp"
          alt="Green Pasture Logo"
          style={{
            height: "100px",
            width: "auto",
            objectFit: "contain",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {/* Payslip Title */}
      <div
        style={{
          textAlign: "center",
          fontSize: "18pt",
          fontWeight: "bold",
          letterSpacing: "3px",
          marginBottom: "15px",
        }}
      >
        P A Y S L I P
      </div>

      {/* Employee and Period Info */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "15px",
          fontSize: "9pt",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{ padding: "3px 5px", fontWeight: "bold", width: "25%" }}
            >
              Employee Name:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {formatName(employee.full_name)}
            </td>
            <td
              style={{ padding: "3px 5px", fontWeight: "bold", width: "25%" }}
            >
              Position:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {employee.position || employee.assigned_hotel || "-"}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "3px 5px", fontWeight: "bold" }}>
              Company Name:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              GREEN PASTURE PEOPLE M
            </td>
            <td style={{ padding: "3px 5px", fontWeight: "bold" }}>
              Period Covered:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {formatPeriod(weekStart, weekEnd)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Earnings and Deductions Table */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        {/* Earnings Section */}
        <div style={{ width: "50%" }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "2px",
              fontSize: "9pt",
            }}
          >
            Earnings:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9pt",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "40%",
                  }}
                ></th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "30%",
                  }}
                >
                  No of
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "30%",
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Basic
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.basic.days > 0
                    ? earningsBreakdown.basic.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.basic.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Overtime
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.overtime.hours > 0
                    ? earningsBreakdown.overtime.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.overtime.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Night Diff
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.nightDiff.hours > 0
                    ? earningsBreakdown.nightDiff.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.nightDiff.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Legal Holiday
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.legalHoliday.days > 0
                    ? earningsBreakdown.legalHoliday.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.legalHoliday.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Legal HD OT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.legalHDOT.hours > 0
                    ? earningsBreakdown.legalHDOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.legalHDOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Legal HD ND
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.legalHDND.hours > 0
                    ? earningsBreakdown.legalHDND.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.legalHDND.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SP Holiday
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.spHoliday.days > 0
                    ? earningsBreakdown.spHoliday.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.spHoliday.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SH OT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.SHOT.hours > 0
                    ? earningsBreakdown.SHOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.SHOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SH ND
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.SHND.hours > 0
                    ? earningsBreakdown.SHND.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.SHND.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SH on RD OT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.SHonRDOT.hours > 0
                    ? earningsBreakdown.SHonRDOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.SHonRDOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  LH on RD OT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.LHonRDOT.hours > 0
                    ? earningsBreakdown.LHonRDOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.LHonRDOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  NDOT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.NDOT.hours > 0
                    ? earningsBreakdown.NDOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.NDOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Rest Day
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.restDay.days > 0
                    ? earningsBreakdown.restDay.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.restDay.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Rest Day OT
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.restDayOT.hours > 0
                    ? earningsBreakdown.restDayOT.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.restDayOT.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Rest Day ND
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.restDayND.hours > 0
                    ? earningsBreakdown.restDayND.hours.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.restDayND.amount)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Working Dayoff
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.workingDayoff.days > 0
                    ? earningsBreakdown.workingDayoff.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.workingDayoff.amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Other Pay Section */}
          <div style={{ marginTop: "5px" }}>
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "2px",
                fontSize: "9pt",
              }}
            >
              Other Pay
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "9pt",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                      width: "40%",
                    }}
                  >
                    Other Pay
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                      width: "30%",
                    }}
                  >
                    -
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                      width: "30%",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.otherPay.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions Section */}
        <div style={{ width: "50%" }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "2px",
              fontSize: "9pt",
              textAlign: "right",
            }}
          >
            Deduction:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9pt",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                  }}
                  colSpan={2}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SSS
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.sssContribution)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SSS Providen
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  -
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  PhilHealth
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.philhealthContribution)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Pagi-Ibig
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.pagibigContribution)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  WTax
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.withholdingTax || 0)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Other Deduction
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Section */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "9pt",
          marginTop: "10px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{ width: "50%", padding: "3px 5px", verticalAlign: "top" }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Total Salary:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(totalSalary)}
              </div>
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Less Tardiness:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(tardiness)}
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  marginTop: "5px",
                  marginBottom: "3px",
                }}
              >
                Total Gross Pay:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  paddingTop: "3px",
                  paddingBottom: "3px",
                }}
              >
                {formatCurrency(totalGrossPay)}
              </div>
            </td>
            <td
              style={{ width: "50%", padding: "3px 5px", verticalAlign: "top" }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Total Deduction:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "1px solid #000",
                  borderBottom: "1px solid #000",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(totalDeductions)}
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  marginTop: "15px",
                  marginBottom: "3px",
                }}
              >
                Net Pay:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  paddingTop: "3px",
                  paddingBottom: "3px",
                  fontSize: "11pt",
                }}
              >
                {formatCurrency(netPay)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Memoize to prevent expensive recalculations when parent re-renders
export const PayslipPrint = memo(PayslipPrintComponent);
