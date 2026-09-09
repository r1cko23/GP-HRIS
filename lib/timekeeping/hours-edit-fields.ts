/** Fields an admin may edit on draft / pending_audit cutoff_hours rows. */
export const CUTOFF_HOURS_EDITABLE_STATUSES = ["draft", "pending_audit"] as const;

export type CutoffHoursEditActor = {
  periodStatus: string | null | undefined;
  role: string | null | undefined;
  viaServiceKey?: boolean;
};

export type CutoffHoursEditDenial =
  | { ok: true }
  | { ok: false; status: 403 | 409; message: string };

export function cutoffHoursWindowOpen(
  periodStatus: string | null | undefined
): boolean {
  return (CUTOFF_HOURS_EDITABLE_STATUSES as readonly string[]).includes(
    periodStatus ?? ""
  );
}

/**
 * Manual hour-bucket edits on the cutoff hub. HR may aggregate and submit;
 * only admin may type values, so extra hours cannot be inserted during audit.
 */
export function cutoffHoursEditDenial(
  input: CutoffHoursEditActor
): CutoffHoursEditDenial {
  if (!cutoffHoursWindowOpen(input.periodStatus)) {
    return {
      ok: false,
      status: 409,
      message: "Hours can only be edited while draft or pending audit",
    };
  }
  if (input.viaServiceKey || input.role !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Only an admin can edit cutoff hours",
    };
  }
  return { ok: true };
}

export function canActorEditCutoffHours(input: CutoffHoursEditActor): boolean {
  return cutoffHoursEditDenial(input).ok;
}

export const HOURS_EDITABLE_FIELDS = [
  "actual_regular_hours",
  "hours_work",
  "overtime_hours",
  "night_diff_hours",
  "regular_night_ot_hours",
  "legal_holiday_hours",
  "legal_holiday_ot_hours",
  "special_holiday_hours",
  "special_holiday_ot_hours",
  "rest_day_hours",
  "rest_day_ot_hours",
  "wdo_hours",
  "pto_hours",
  "tardiness_hours",
  "undertime_hours",
  "absences_hours",
  "allowance",
  "daily_rate_payroll",
] as const;
