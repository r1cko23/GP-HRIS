/**
 * Batched payslip editor context — parallelizes the sequential client waterfalls
 * in app/payslips/page.tsx loadAttendanceAndDeductions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { format, addDays, subDays } from "date-fns";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employeeId = request.nextUrl.searchParams.get("employee_id");
    const periodStartParam = request.nextUrl.searchParams.get("period_start");
    const alsoEmployeeId = request.nextUrl.searchParams.get("also_employee_id");

    if (!employeeId || !UUID_RE.test(employeeId)) {
      return NextResponse.json(
        { error: "Valid employee_id is required" },
        { status: 400 }
      );
    }
    if (!periodStartParam) {
      return NextResponse.json(
        { error: "period_start is required (yyyy-MM-dd)" },
        { status: 400 }
      );
    }

    const periodStart = new Date(`${periodStartParam}T12:00:00`);
    if (Number.isNaN(periodStart.getTime())) {
      return NextResponse.json(
        { error: "Invalid period_start" },
        { status: 400 }
      );
    }

    const periodEnd = getBiMonthlyPeriodEnd(periodStart);
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const periodEndStr = format(periodEnd, "yyyy-MM-dd");

    // Wider clock window (±1 day) to match timesheet timezone filtering.
    const clockStart = format(subDays(periodStart, 1), "yyyy-MM-dd");
    const clockEnd = format(addDays(periodEnd, 1), "yyyy-MM-dd");

    const otEmployeeIds = [employeeId];
    if (alsoEmployeeId && UUID_RE.test(alsoEmployeeId)) {
      otEmployeeIds.push(alsoEmployeeId);
    }

    const supabase = createServerComponentClient({ cookies });

    const [
      weeklyAttendanceRes,
      existingPayslipRes,
      leaveRes,
      clockRes,
      holidaysRes,
      schedulesRes,
      overtimeRes,
      loansRes,
      deductionsRes,
    ] = await Promise.all([
      supabase
        .from("weekly_attendance")
        .select(
          "id, status, attendance_data, gross_pay, total_regular_hours, total_overtime_hours, total_night_diff_hours"
        )
        .eq("employee_id", employeeId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .maybeSingle(),
      supabase
        .from("payslips")
        .select(
          "id, status, gross_pay, total_deductions, net_pay, adjustment_amount, adjustment_reason, deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount, earnings_breakdown"
        )
        .eq("employee_id", employeeId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .maybeSingle(),
      supabase
        .from("leave_requests")
        .select(
          "id, leave_type, start_date, end_date, status, selected_dates, half_day_dates"
        )
        .eq("employee_id", employeeId)
        .lte("start_date", periodEndStr)
        .gte("end_date", periodStartStr)
        .in("status", ["approved_by_manager", "approved_by_hr"]),
      supabase
        .from("time_clock_entries")
        .select(
          "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
        )
        .eq("employee_id", employeeId)
        .gte("clock_in_time", `${clockStart}T00:00:00`)
        .lte("clock_in_time", `${clockEnd}T23:59:59`)
        .order("clock_in_time", { ascending: true }),
      supabase
        .from("holidays")
        .select("id, holiday_date, holiday_name, holiday_type")
        .gte("holiday_date", periodStartStr)
        .lte("holiday_date", periodEndStr),
      supabase
        .from("employee_week_schedules")
        .select("schedule_date, day_off, start_time, end_time")
        .eq("employee_id", employeeId)
        .gte("schedule_date", periodStartStr)
        .lte("schedule_date", periodEndStr),
      supabase
        .from("overtime_requests")
        .select("ot_date, end_date, start_time, end_time, total_hours, status")
        .in("employee_id", otEmployeeIds)
        .in("status", ["approved", "approved_by_manager", "approved_by_hr"])
        .gte("ot_date", periodStartStr)
        .lte("ot_date", periodEndStr),
      supabase
        .from("employee_loans")
        .select(
          "id, loan_type, monthly_payment, cutoff_assignment, deduct_bi_monthly, current_balance, effectivity_date, is_active, total_terms, remaining_terms"
        )
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .lte("effectivity_date", periodEndStr)
        .gt("current_balance", 0),
      supabase
        .from("employee_deductions")
        .select("deduction_type, amount, deduction_date")
        .eq("employee_id", employeeId)
        .gte("deduction_date", periodStartStr)
        .lte("deduction_date", periodEndStr),
    ]);

    const weekly = weeklyAttendanceRes.data;
    let timesheetStatus: "missing" | "draft" | "finalized" = "missing";
    if (weekly) {
      timesheetStatus =
        weekly.status === "finalized" ? "finalized" : "draft";
    }

    const holidays = (holidaysRes.data ?? []).map((h) => {
      const holidayType = h.holiday_type === "regular" ? "regular" : "non-working";
      return {
        holiday_date: h.holiday_date,
        name: h.holiday_name || "",
        holiday_name: h.holiday_name || "",
        holiday_type: holidayType,
        is_regular: holidayType === "regular",
      };
    });

    return NextResponse.json({
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      timesheetStatus,
      weeklyAttendance: weekly,
      existingPayslip: existingPayslipRes.data,
      leaveRequests: leaveRes.data ?? [],
      timeClockEntries: clockRes.data ?? [],
      holidays,
      schedules: schedulesRes.data ?? [],
      overtimeRequests: overtimeRes.data ?? [],
      loans: loansRes.data ?? [],
      deductions: deductionsRes.data ?? [],
      errors: {
        leave: leaveRes.error?.message ?? null,
        clock: clockRes.error?.message ?? null,
        holidays: holidaysRes.error?.message ?? null,
        schedules: schedulesRes.error?.message ?? null,
        overtime: overtimeRes.error?.message ?? null,
        loans: loansRes.error?.message ?? null,
        deductions: deductionsRes.error?.message ?? null,
      },
    });
  } catch (error: unknown) {
    console.error("Payslip context GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load payslip context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
