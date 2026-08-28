export const CUTOFF_PERIOD_STATUSES = [
  "draft",
  "pending_audit",
  "approved",
  "posted",
  "cancelled",
] as const;

export type CutoffPeriodStatus = (typeof CUTOFF_PERIOD_STATUSES)[number];

export type CutoffHoursIngestRow = {
  directory_employee_id: string;
  office_employee_id?: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  actual_regular_hours?: number;
  hours_work?: number;
  overtime_hours?: number;
  night_diff_hours?: number;
  regular_night_ot_hours?: number;
  legal_holiday_hours?: number;
  legal_holiday_ot_hours?: number;
  legal_holiday_nd_hours?: number;
  legal_holiday_ot_nd_hours?: number;
  special_holiday_hours?: number;
  special_holiday_ot_hours?: number;
  special_holiday_nd_hours?: number;
  special_holiday_ot_nd_hours?: number;
  rest_day_hours?: number;
  rest_day_ot_hours?: number;
  rest_day_nd_hours?: number;
  rest_day_ot_nd_hours?: number;
  lh_rest_day_hours?: number;
  lh_rest_day_ot_hours?: number;
  sh_rest_day_hours?: number;
  sh_rest_day_ot_hours?: number;
  wdo_hours?: number;
  tardiness_hours?: number;
  undertime_hours?: number;
  absences_hours?: number;
  pto_hours?: number;
  allowance?: number | null;
  daily_rate_payroll?: number | null;
  rate_snapshot?: Record<string, unknown> | null;
  remarks?: string | null;
  tk_status?: string | null;
  source_of_data?: string | null;
  legacy_idtimekeep?: number | null;
};

export type CutoffDtrPunchIngestRow = {
  directory_employee_id: string;
  work_date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  break_minutes?: number;
  source?: string | null;
  remarks?: string | null;
  legacy_row_id?: number | null;
};

export type CutoffIngestBody = {
  hours?: CutoffHoursIngestRow[];
  punches?: CutoffDtrPunchIngestRow[];
  replace_existing?: boolean;
};

export type CreateCutoffPeriodBody = {
  client_id: string;
  period_start: string;
  period_end: string;
  payroll_date?: string | null;
  pay_frequency?: "weekly" | "semi-monthly" | "monthly" | null;
  source_app?: string | null;
  status?: CutoffPeriodStatus;
  legacy_idtimekeep?: number | null;
  notes?: string | null;
};

const HOUR_FIELDS: Array<keyof CutoffHoursIngestRow> = [
  "actual_regular_hours",
  "hours_work",
  "overtime_hours",
  "night_diff_hours",
  "regular_night_ot_hours",
  "legal_holiday_hours",
  "legal_holiday_ot_hours",
  "legal_holiday_nd_hours",
  "legal_holiday_ot_nd_hours",
  "special_holiday_hours",
  "special_holiday_ot_hours",
  "special_holiday_nd_hours",
  "special_holiday_ot_nd_hours",
  "rest_day_hours",
  "rest_day_ot_hours",
  "rest_day_nd_hours",
  "rest_day_ot_nd_hours",
  "lh_rest_day_hours",
  "lh_rest_day_ot_hours",
  "sh_rest_day_hours",
  "sh_rest_day_ot_hours",
  "wdo_hours",
  "tardiness_hours",
  "undertime_hours",
  "absences_hours",
  "pto_hours",
];

export function normalizeHoursRow(
  row: CutoffHoursIngestRow
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    directory_employee_id: row.directory_employee_id,
    office_employee_id: row.office_employee_id ?? null,
    branch_id: row.branch_id ?? null,
    position_id: row.position_id ?? null,
    employee_code: row.employee_code ?? null,
    last_name: row.last_name ?? null,
    first_name: row.first_name ?? null,
    allowance: row.allowance ?? null,
    daily_rate_payroll: row.daily_rate_payroll ?? null,
    rate_snapshot: row.rate_snapshot ?? null,
    remarks: row.remarks ?? null,
    tk_status: row.tk_status ?? null,
    source_of_data: row.source_of_data ?? null,
    legacy_idtimekeep: row.legacy_idtimekeep ?? null,
  };

  for (const key of HOUR_FIELDS) {
    const val = row[key];
    out[key] = typeof val === "number" && Number.isFinite(val) ? val : 0;
  }

  return out;
}
