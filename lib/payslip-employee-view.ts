/**
 * Map saved payslip rows + employee profile into PayslipPrint props (employee portal).
 */

export type EmployeeProfileForPayslip = {
  employee_id: string;
  full_name: string;
  position?: string | null;
  employee_type?: string | null;
  job_level?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  assigned_hotel?: string | null;
};

export type SavedPayslipForDisplay = {
  id: string;
  employee_id: string;
  payslip_number: string;
  period_start: string;
  period_end: string;
  status: string;
  gross_pay: number;
  net_pay: number;
  sss_amount: number;
  philhealth_amount: number;
  pagibig_amount: number;
  withholding_tax?: number;
  total_deductions: number;
  adjustment_amount: number;
  adjustment_reason: string | null;
  earnings_breakdown: Record<string, unknown> | null;
  deductions_breakdown: Record<string, unknown> | null;
  created_at: string;
};

export function ratePerDayAndHourFromProfile(
  profile: EmployeeProfileForPayslip
): { perDay: number; perHour: number } {
  const perDay =
    Number(profile.per_day ?? 0) ||
    (Number(profile.monthly_rate ?? 0) > 0
      ? Number(profile.monthly_rate) / 26
      : 0);
  const perHour = perDay > 0 ? perDay / 8 : 0;
  return { perDay, perHour };
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function buildPayslipPrintProps(
  payslip: SavedPayslipForDisplay,
  profile: EmployeeProfileForPayslip,
  preparedBy = "HR Department"
) {
  const { perDay, perHour } = ratePerDayAndHourFromProfile(profile);
  const earnings = (payslip.earnings_breakdown || {}) as Record<string, unknown>;
  const deductions = (payslip.deductions_breakdown || {}) as Record<
    string,
    unknown
  >;

  const attendance =
    earnings.attendance_data ??
    earnings.payroll_result ??
    earnings;

  return {
    employee: {
      employee_id: profile.employee_id,
      full_name: profile.full_name,
      rate_per_day: perDay,
      rate_per_hour: perHour,
      position: profile.position ?? null,
      assigned_hotel: profile.assigned_hotel ?? null,
      employee_type: (profile.employee_type as
        | "office-based"
        | "client-based"
        | null) ?? null,
      job_level: profile.job_level ?? null,
    },
    weekStart: new Date(payslip.period_start),
    weekEnd: new Date(payslip.period_end),
    attendance,
    earnings: {
      regularPay: num(earnings.regularPay),
      regularOT: num(earnings.regularOT),
      regularOTHours: num(earnings.regularOTHours),
      nightDiff: num(earnings.nightDiff),
      nightDiffHours: num(earnings.nightDiffHours),
      sundayRestDay: num(earnings.sundayRestDay),
      sundayRestDayHours: num(earnings.sundayRestDayHours),
      specialHoliday: num(earnings.specialHoliday),
      specialHolidayHours: num(earnings.specialHolidayHours),
      regularHoliday: num(earnings.regularHoliday),
      regularHolidayHours: num(earnings.regularHolidayHours),
      grossIncome: num(payslip.gross_pay),
    },
    deductions: {
      vale: num(deductions.vale_amount),
      sssLoan: num(deductions.sss_salary_loan),
      sssCalamityLoan: num(deductions.sss_calamity_loan),
      pagibigLoan: num(deductions.pagibig_salary_loan),
      pagibigCalamityLoan: num(deductions.pagibig_calamity_loan),
      sssContribution: num(payslip.sss_amount),
      philhealthContribution: num(payslip.philhealth_amount),
      pagibigContribution: num(payslip.pagibig_amount),
      withholdingTax:
        num(payslip.withholding_tax) ||
        num(deductions.withholding_tax),
      totalDeductions: num(payslip.total_deductions),
    },
    adjustment: num(payslip.adjustment_amount),
    adjustmentReason: payslip.adjustment_reason,
    netPay: num(payslip.net_pay),
    workingDays: num(earnings.workingDays),
    absentDays: num(earnings.absentDays),
    preparedBy,
  };
}

export function payslipMonthKey(payslip: { period_start: string; period_end: string }): string {
  const dateStr = String(payslip.period_end || payslip.period_start).split("T")[0];
  const [year, month] = dateStr.split("-");
  return `${year}-${month}`;
}
