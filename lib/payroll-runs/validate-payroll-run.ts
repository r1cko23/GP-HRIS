/**
 * Validate payroll run readiness (GP bi-monthly, Addbell payroll run pattern).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import {
  buildPayrollEntryRow,
  summarizePayrollEntry,
  type PayrollEntryEmployeeInput,
  type PayrollEntrySummary,
} from "@/lib/ph-payroll/payroll-entry-validation";

export type PayrollRunRow = {
  id: string;
  cutoff_start: string;
  cutoff_end: string;
  selected_employee_ids: string[] | null;
  status: string;
};

export async function validatePayrollRun(
  admin: SupabaseClient,
  run: PayrollRunRow
): Promise<PayrollEntrySummary & { payroll_run_id: string }> {
  const cutoffStart = String(run.cutoff_start);
  const cutoffEnd = String(run.cutoff_end);
  const periodStart = new Date(`${cutoffStart}T12:00:00`);
  const periodEnd = new Date(`${cutoffEnd}T12:00:00`);

  let empQuery = admin
    .from("employees")
    .select(
      "id, employee_id, full_name, position, job_level, employee_type, monthly_rate, per_day, hire_date"
    )
    .eq("is_active", true);

  const scopeIds = Array.isArray(run.selected_employee_ids)
    ? run.selected_employee_ids.map(String)
    : null;

  if (scopeIds?.length) {
    empQuery = empQuery.in("id", scopeIds);
  }

  const { data: employees, error: empErr } = await empQuery;
  if (empErr) throw empErr;

  const employeeList = (employees || []) as PayrollEntryEmployeeInput[];
  const employeeIds = employeeList.map((e) => e.id);
  const emptyId = "00000000-0000-0000-0000-000000000000";
  const idFilter = employeeIds.length ? employeeIds : [emptyId];

  const [
    { data: payslips },
    { data: holidays },
    { data: clockEntries },
    { data: weeklyAttendance },
  ] = await Promise.all([
    admin
      .from("payslips")
      .select("id, employee_id, status, gross_pay, net_pay")
      .eq("payroll_run_id", run.id)
      .in("employee_id", idFilter),
    admin
      .from("holidays")
      .select("holiday_date")
      .gte("holiday_date", cutoffStart)
      .lte("holiday_date", cutoffEnd),
    admin
      .from("time_clock_entries")
      .select("employee_id, clock_in_time")
      .in("employee_id", idFilter)
      .gte("clock_in_time", `${cutoffStart}T00:00:00`)
      .lte("clock_in_time", `${cutoffEnd}T23:59:59`)
      .in("status", ["approved", "auto_approved", "clocked_out"]),
    admin
      .from("weekly_attendance")
      .select("id, employee_id, status")
      .eq("period_start", cutoffStart)
      .eq("period_end", cutoffEnd)
      .in("employee_id", idFilter),
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
      periodEnd: getBiMonthlyPeriodEnd(periodStart),
    })
  );

  return {
    payroll_run_id: run.id,
    periodStart: cutoffStart,
    periodEnd: cutoffEnd,
    ...summarizePayrollEntry(rows),
    rows,
  };
}
