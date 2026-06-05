/**
 * Payroll Entry API (Frappe HR Payroll Entry pattern)
 *
 * GET  /api/payroll/entry?period_start=YYYY-MM-DD — validation dashboard data
 * POST /api/payroll/entry — bulk generate draft payslips
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { format } from "date-fns";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import {
  buildPayrollEntryRow,
  summarizePayrollEntry,
  type PayrollEntryEmployeeInput,
} from "@/lib/ph-payroll/payroll-entry-validation";
import { generatePayslipForEmployee } from "@/lib/ph-payroll/bulk-payslip";

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const periodStartParam =
      request.nextUrl.searchParams.get("period_start") ||
      format(new Date(), "yyyy-MM-dd");

    const periodStart = new Date(periodStartParam);
    const periodEnd = getBiMonthlyPeriodEnd(periodStart);
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const periodEndStr = format(periodEnd, "yyyy-MM-dd");

    const supabase = createServerComponentClient({ cookies });

    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select(
        "id, employee_id, full_name, position, job_level, employee_type, monthly_rate, per_day, hire_date"
      )
      .eq("is_active", true)
      .order("full_name");

    if (empError) throw empError;

    const employeeList = (employees || []) as PayrollEntryEmployeeInput[];
    const employeeIds = employeeList.map((e) => e.id);

    const [
      { data: payslips },
      { data: holidays },
      { data: clockEntries },
      { data: weeklyAttendance },
    ] = await Promise.all([
        supabase
          .from("payslips")
          .select("id, employee_id, status, gross_pay, net_pay")
          .eq("period_start", periodStartStr)
          .eq("period_end", periodEndStr)
          .in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("holidays")
          .select("holiday_date")
          .gte("holiday_date", periodStartStr)
          .lte("holiday_date", periodEndStr),
        supabase
          .from("time_clock_entries")
          .select("employee_id, clock_in_time")
          .in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("clock_in_time", `${periodStartStr}T00:00:00`)
          .lte("clock_in_time", `${periodEndStr}T23:59:59`)
          .in("status", ["approved", "auto_approved", "clocked_out"]),
        supabase
          .from("weekly_attendance")
          .select("id, employee_id, status")
          .eq("period_start", periodStartStr)
          .eq("period_end", periodEndStr)
          .in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

    const payslipMap = new Map(
      (payslips || []).map((p) => [
        p.employee_id,
        {
          id: p.id,
          status: p.status,
          gross_pay: p.gross_pay,
          net_pay: p.net_pay,
        },
      ])
    );

    const timesheetMap = new Map(
      (weeklyAttendance || []).map((t) => [t.employee_id, t])
    );

    const clockCounts = new Map<string, number>();
    const clockDatesByEmployee = new Map<string, Set<string>>();

    (clockEntries || []).forEach((entry) => {
      const id = entry.employee_id as string;
      clockCounts.set(id, (clockCounts.get(id) ?? 0) + 1);

      const entryDatePH = new Date(
        new Date(entry.clock_in_time).toLocaleString("en-US", {
          timeZone: "Asia/Manila",
        })
      );
      const dateStr = format(entryDatePH, "yyyy-MM-dd");
      if (!clockDatesByEmployee.has(id)) {
        clockDatesByEmployee.set(id, new Set());
      }
      clockDatesByEmployee.get(id)!.add(dateStr);
    });

    const holidayRows = (holidays || []).map((h) => ({
      holiday_date: h.holiday_date,
    }));

    const rows = employeeList.map((emp) =>
      buildPayrollEntryRow(emp, {
        clockEntryCount: clockCounts.get(emp.id) ?? 0,
        clockEntryDates: clockDatesByEmployee.get(emp.id) ?? new Set(),
        payslip: payslipMap.get(emp.id) ?? null,
        timesheet: timesheetMap.get(emp.id) ?? null,
        holidays: holidayRows,
        periodStart,
        periodEnd,
      })
    );

    const summary = summarizePayrollEntry(rows);

    return NextResponse.json({
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      ...summary,
      rows,
    });
  } catch (error: unknown) {
    console.error("Payroll entry GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load payroll entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      period_start,
      employee_ids,
      overwrite = false,
      include_warnings = false,
    } = body as {
      period_start: string;
      employee_ids?: string[];
      overwrite?: boolean;
      include_warnings?: boolean;
    };

    if (!period_start) {
      return NextResponse.json(
        { error: "period_start is required" },
        { status: 400 }
      );
    }

    const periodStart = new Date(period_start);
    const supabase = createServerComponentClient({ cookies });

    let employeesQuery = supabase
      .from("employees")
      .select(
        "id, employee_id, full_name, monthly_rate, per_day, employee_type, position, job_level"
      )
      .eq("is_active", true);

    if (employee_ids?.length) {
      employeesQuery = employeesQuery.in("id", employee_ids);
    }

    const { data: employees, error: empError } = await employeesQuery;
    if (empError) throw empError;

    const results = [];
    for (const employee of employees || []) {
      try {
        const result = await generatePayslipForEmployee(
          supabase,
          employee,
          periodStart,
          { overwrite }
        );
        results.push(result);
      } catch (err: unknown) {
        results.push({
          status: "skipped",
          employeeId: employee.id,
          employeeName: employee.full_name,
          reason: err instanceof Error ? err.message : "Generation failed",
        });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const updated = results.filter((r) => r.status === "updated").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      created,
      updated,
      skipped,
      total: results.length,
      results,
    });
  } catch (error: unknown) {
    console.error("Payroll entry POST error:", error);
    const message =
      error instanceof Error ? error.message : "Bulk generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
