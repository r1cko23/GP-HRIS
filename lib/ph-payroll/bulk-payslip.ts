/**
 * Bulk payslip generation for Payroll Entry (Frappe HR Payroll Entry pattern).
 * Generates draft payslips from time clock entries for one employee + cutoff.
 */

import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBiMonthlyPeriodEnd } from "@/utils/bimonthly";
import { generatePayslipNumber } from "@/utils/format";
import { aggregateCutoffDeductions } from "./deductions-loader";
import { computeCutoffPayslipAmounts } from "./compute-cutoff-payslip";
import { getRatePerHour, getMonthlySalary } from "./employee-rates";

export type BulkPayslipResult =
  | { status: "created"; employeeId: string; employeeName: string; payslipNumber: string; grossPay: number; netPay: number }
  | { status: "updated"; employeeId: string; employeeName: string; payslipNumber: string; grossPay: number; netPay: number }
  | { status: "skipped"; employeeId: string; employeeName: string; reason: string };

type EmployeeRow = {
  id: string;
  employee_id: string;
  full_name: string;
  monthly_rate?: number | null;
  per_day?: number | null;
  employee_type?: string | null;
  position?: string | null;
  job_level?: string | null;
};

export async function generatePayslipForEmployee(
  supabase: SupabaseClient,
  employee: EmployeeRow,
  periodStart: Date,
  options: { overwrite?: boolean } = {}
): Promise<BulkPayslipResult> {
  const periodEnd = getBiMonthlyPeriodEnd(periodStart);
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");
  const ratePerHour = getRatePerHour(employee);
  const monthlySalary = getMonthlySalary(employee);

  if (ratePerHour <= 0 || monthlySalary <= 0) {
    return {
      status: "skipped",
      employeeId: employee.id,
      employeeName: employee.full_name,
      reason: "Missing pay rate",
    };
  }

  const year = periodStart.getFullYear();
  const periodNumber = Math.ceil(
    (periodStart.getDate() +
      (periodStart.getDay() === 0 ? 7 : periodStart.getDay() - 1)) /
      14
  );
  const payslipNumber = generatePayslipNumber(
    employee.employee_id,
    periodNumber,
    year
  );

  if (!options.overwrite) {
    const { data: existing } = await supabase
      .from("payslips")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("period_start", periodStartStr)
      .eq("period_end", periodEndStr)
      .maybeSingle();

    if (existing) {
      return {
        status: "skipped",
        employeeId: employee.id,
        employeeName: employee.full_name,
        reason: "Payslip already exists",
      };
    }
  }

  // Phase 4 gating: only generate payslips from finalized timesheets.
  const { data: weeklyAttendance } = await supabase
    .from("weekly_attendance")
    .select(
      "id,status,attendance_data,gross_pay,total_regular_hours,total_overtime_hours,total_night_diff_hours"
    )
    .eq("employee_id", employee.id)
    .eq("period_start", periodStartStr)
    .eq("period_end", periodEndStr)
    .maybeSingle();

  if (!weeklyAttendance || weeklyAttendance.status !== "finalized") {
    return {
      status: "skipped",
      employeeId: employee.id,
      employeeName: employee.full_name,
      reason: "Timesheet not finalized for this cutoff",
    };
  }

  const timesheetData = {
    attendance_data: weeklyAttendance.attendance_data ?? [],
  };

  const storedGrossPay = Number(weeklyAttendance.gross_pay ?? 0) || 0;

  const { data: deductionRows } = await supabase
    .from("employee_deductions")
    .select("deduction_type, amount")
    .eq("employee_id", employee.id)
    .gte("deduction_date", periodStartStr)
    .lte("deduction_date", periodEndStr);

  const deductions = aggregateCutoffDeductions(deductionRows || []);

  const { data: loans } = await supabase
    .from("employee_loans")
    .select("loan_type, monthly_payment, cutoff_assignment, deduct_bi_monthly")
    .eq("employee_id", employee.id)
    .eq("is_active", true)
    .lte("effectivity_date", periodEndStr)
    .gt("current_balance", 0);

  const amounts = computeCutoffPayslipAmounts({
    employee,
    periodStart,
    attendanceData: timesheetData.attendance_data,
    grossPayOverride: storedGrossPay,
    deductions,
    loans: loans || [],
  });

  const { grossPay, totalDeductions, netPay, deductionsBreakdown, cutoffStatutory } =
    amounts;

  const payslipData = {
    employee_id: employee.id,
    payslip_number: payslipNumber,
    week_number: periodNumber,
    period_start: periodStartStr,
    period_end: periodEndStr,
    period_type: "bimonthly" as const,
    earnings_breakdown: timesheetData.attendance_data,
    gross_pay: grossPay,
    deductions_breakdown: deductionsBreakdown,
    total_deductions: totalDeductions,
    apply_sss: true,
    apply_philhealth: true,
    apply_pagibig: true,
    sss_amount: cutoffStatutory.sss,
    philhealth_amount: cutoffStatutory.philhealth,
    pagibig_amount: cutoffStatutory.pagibig,
    thirteenth_month_pay: 0,
    adjustment_amount: 0,
    adjustment_reason: null,
    allowance_amount: 0,
    net_pay: netPay,
    status: "draft" as const,
    created_by: null,
  };

  const { data: existingByNumber } = await supabase
    .from("payslips")
    .select("id")
    .eq("payslip_number", payslipNumber)
    .maybeSingle();

  if (existingByNumber && options.overwrite) {
    const { error } = await supabase
      .from("payslips")
      .update(payslipData)
      .eq("id", existingByNumber.id);
    if (error) throw error;
    return {
      status: "updated",
      employeeId: employee.id,
      employeeName: employee.full_name,
      payslipNumber,
      grossPay,
      netPay,
    };
  }

  const { error: insertError } = await supabase
    .from("payslips")
    .insert(payslipData);

  if (insertError) throw insertError;

  return {
    status: "created",
    employeeId: employee.id,
    employeeName: employee.full_name,
    payslipNumber,
    grossPay,
    netPay,
  };
}
