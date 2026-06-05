/**
 * Payroll Entry validation (Frappe HR Payroll Entry pre-check pattern).
 * Determines per-employee readiness before bulk payslip generation.
 */

import { calculateBasePay } from "@/utils/base-pay-calculator";
import { parseISO } from "date-fns";

export type PayrollEntryStatus =
  | "saved"
  | "ready"
  | "warning"
  | "blocked";

export interface PayrollEntryEmployeeInput {
  id: string;
  employee_id: string;
  full_name: string;
  position?: string | null;
  job_level?: string | null;
  employee_type?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  hire_date?: string | null;
}

export type TimesheetWorkflowStatus = "missing" | "draft" | "finalized";

export interface PayrollEntryRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  jobLevel: string | null;
  status: PayrollEntryStatus;
  timesheetStatus: TimesheetWorkflowStatus;
  issues: string[];
  warnings: string[];
  clockEntryCount: number;
  absences: number;
  hasRate: boolean;
  payslipId: string | null;
  payslipStatus: string | null;
  grossPay: number | null;
  netPay: number | null;
}

export interface PayrollEntrySummary {
  periodStart: string;
  periodEnd: string;
  total: number;
  saved: number;
  ready: number;
  warning: number;
  blocked: number;
  timesheetsFinalized: number;
  timesheetsDraft: number;
  timesheetsMissing: number;
  totalGross: number;
  totalNet: number;
  rows: PayrollEntryRow[];
}

interface ValidateParams {
  periodStart: Date;
  periodEnd: Date;
  employees: PayrollEntryEmployeeInput[];
  clockCounts: Map<string, number>;
  payslips: Map<
    string,
    {
      id: string;
      status: string;
      gross_pay: number;
      net_pay: number;
    }
  >;
  holidays: Array<{ holiday_date: string }>;
}

function hasPayRate(emp: PayrollEntryEmployeeInput): boolean {
  return (emp.monthly_rate ?? 0) > 0 || (emp.per_day ?? 0) > 0;
}

function countAbsences(
  emp: PayrollEntryEmployeeInput,
  clockEntryDates: Set<string>,
  holidays: Array<{ holiday_date: string }>,
  periodStart: Date,
  periodEnd: Date
): number {
  const isClientBased = emp.employee_type === "client-based";
  const isAccountSupervisor =
    emp.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false;

  const result = calculateBasePay({
    periodStart,
    periodEnd,
    clockEntries: Array.from(clockEntryDates).map((date) => ({
      clock_in_time: `${date}T08:00:00`,
      clock_out_time: `${date}T17:00:00`,
    })),
    holidays,
    isClientBased,
    isAccountSupervisor,
    hireDate: emp.hire_date ? parseISO(emp.hire_date) : undefined,
  });

  return result.absences;
}

export function buildPayrollEntryRow(
  emp: PayrollEntryEmployeeInput,
  params: {
    clockEntryCount: number;
    clockEntryDates: Set<string>;
    timesheet: { id: string; status: string } | null;
    payslip: {
      id: string;
      status: string;
      gross_pay: number;
      net_pay: number;
    } | null;
    holidays: Array<{ holiday_date: string }>;
    periodStart: Date;
    periodEnd: Date;
  }
): PayrollEntryRow {
  const issues: string[] = [];
  const warnings: string[] = [];
  const hasRate = hasPayRate(emp);
  const timesheetStatus: TimesheetWorkflowStatus = !params.timesheet
    ? "missing"
    : params.timesheet.status === "finalized"
      ? "finalized"
      : "draft";
  const hasFinalizedTimesheet = timesheetStatus === "finalized";

  if (!hasRate) {
    issues.push("Missing monthly rate or per-day rate");
  }

  const absences = countAbsences(
    emp,
    params.clockEntryDates,
    params.holidays,
    params.periodStart,
    params.periodEnd
  );

  if (absences > 0) {
    warnings.push(`${absences} absence(s) in cutoff`);
  }

  if (params.clockEntryCount === 0) {
    const isManagerial =
      emp.job_level?.toUpperCase() === "MANAGERIAL" ||
      emp.job_level?.toUpperCase() === "SUPERVISORY";
    if (isManagerial) {
      warnings.push("No clock entries (managerial — base pay still applies)");
    } else if (emp.employee_type !== "client-based") {
      warnings.push("No clock entries (office-based may still get Saturday credit)");
    } else {
      issues.push("No clock entries for client-based employee");
    }
  }

  // Phase 4 gating: only generate payslips from finalized timesheets.
  // If a payslip already exists, we treat the row as "saved" and do not block.
  if (!params.payslip && !hasFinalizedTimesheet) {
    issues.push("Timesheet not finalized for this cutoff");
  }

  let status: PayrollEntryStatus;
  if (params.payslip) {
    status = "saved";
  } else if (issues.length > 0) {
    status = "blocked";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "ready";
  }

  return {
    employeeId: emp.id,
    employeeCode: emp.employee_id,
    fullName: emp.full_name,
    position: emp.position ?? null,
    jobLevel: emp.job_level ?? null,
    status,
    timesheetStatus,
    issues,
    warnings,
    clockEntryCount: params.clockEntryCount,
    absences,
    hasRate,
    payslipId: params.payslip?.id ?? null,
    payslipStatus: params.payslip?.status ?? null,
    grossPay: params.payslip?.gross_pay ?? null,
    netPay: params.payslip?.net_pay ?? null,
  };
}

export function summarizePayrollEntry(rows: PayrollEntryRow[]): Omit<
  PayrollEntrySummary,
  "periodStart" | "periodEnd" | "rows"
> {
  return {
    total: rows.length,
    saved: rows.filter((r) => r.status === "saved").length,
    ready: rows.filter((r) => r.status === "ready").length,
    warning: rows.filter((r) => r.status === "warning").length,
    blocked: rows.filter((r) => r.status === "blocked").length,
    timesheetsFinalized: rows.filter((r) => r.timesheetStatus === "finalized")
      .length,
    timesheetsDraft: rows.filter((r) => r.timesheetStatus === "draft").length,
    timesheetsMissing: rows.filter((r) => r.timesheetStatus === "missing")
      .length,
    totalGross: rows.reduce((s, r) => s + (r.grossPay ?? 0), 0),
    totalNet: rows.reduce((s, r) => s + (r.netPay ?? 0), 0),
  };
}

export function validatePayrollEntry(params: ValidateParams): PayrollEntrySummary {
  const periodStartStr = params.periodStart.toISOString().split("T")[0];
  const periodEndStr = params.periodEnd.toISOString().split("T")[0];

  const rows = params.employees.map((emp) => {
    const clockEntryCount = params.clockCounts.get(emp.id) ?? 0;
    const payslip = params.payslips.get(emp.id) ?? null;

    return buildPayrollEntryRow(emp, {
      clockEntryCount,
      clockEntryDates: new Set(),
      timesheet: null,
      payslip,
      holidays: params.holidays,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    });
  });

  return {
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    ...summarizePayrollEntry(rows),
    rows,
  };
}
