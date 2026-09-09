/**
 * Map GREENHRISMAIN payroll_summary hour / timekeep columns → cutoff_hours.
 * Catalog import only (ADR 0009).
 */

import type { CutoffHoursIngestRow } from "@/lib/timekeeping/cutoff-types";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Read a field under several MAIN casing variants. */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase()
    );
    if (found && row[found] != null && row[found] !== "") return row[found];
  }
  return null;
}

/** Prefer first positive numeric among keys; else first defined (including 0). */
function pickHours(row: Record<string, unknown>, ...keys: string[]): number {
  let fallback = 0;
  let saw = false;
  for (const key of keys) {
    let raw: unknown = row[key];
    if (raw == null || raw === "") {
      const found = Object.keys(row).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      raw = found ? row[found] : null;
    }
    if (raw == null || raw === "") continue;
    const v = n(raw);
    if (!saw) {
      fallback = v;
      saw = true;
    }
    if (v > 0) return v;
  }
  return fallback;
}

export function mainHoursToCutoffRow(input: {
  directoryEmployeeId: string;
  officeEmployeeId?: string | null;
  branchId?: string | null;
  positionId?: string | null;
  employeeCode?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  source: Record<string, unknown>;
}): CutoffHoursIngestRow {
  const src = input.source;
  const legacyTk = pick(src, "idtimekeep", "legacy_idtimekeep");
  return {
    directory_employee_id: input.directoryEmployeeId,
    office_employee_id: input.officeEmployeeId ?? null,
    branch_id: input.branchId ?? null,
    position_id: input.positionId ?? null,
    employee_code: input.employeeCode ?? null,
    last_name: input.lastName ?? text(pick(src, "last_name", "lname")),
    first_name: input.firstName ?? text(pick(src, "first_name", "fname")),
    actual_regular_hours: pickHours(
      src,
      "actualregularhours",
      "actual_regular_hours",
      "noofhourswork"
    ),
    hours_work: pickHours(
      src,
      "noofhourswork",
      "hours_work",
      "actualregularhours"
    ),
    overtime_hours: pickHours(src, "Overtime_Hours", "overtime_hours"),
    night_diff_hours: pickHours(src, "Nightdiff_Hours", "night_diff_hours"),
    regular_night_ot_hours: pickHours(
      src,
      "regularnightshiftOT_hours",
      "regular_night_ot_hours"
    ),
    legal_holiday_hours: pickHours(
      src,
      "LegalHoliday_Hours",
      "legal_holiday_hours"
    ),
    legal_holiday_ot_hours: pickHours(
      src,
      "LegalHolidayOT_Hours",
      "LegalHoliday_OT_Hours",
      "legal_holiday_ot_hours"
    ),
    legal_holiday_nd_hours: pickHours(
      src,
      "LegalHolidayND_Hours",
      "LegalHoliday_ND_Hours",
      "legal_holiday_nd_hours"
    ),
    legal_holiday_ot_nd_hours: pickHours(
      src,
      "lhotndh",
      "legal_holiday_ot_nd_hours"
    ),
    special_holiday_hours: pickHours(
      src,
      "Holiday_Special_Hours",
      "special_holiday_hours"
    ),
    special_holiday_ot_hours: pickHours(
      src,
      "Holiday_SpecialOT_Hours",
      "Holiday_Special_OT_Hours",
      "special_holiday_ot_hours"
    ),
    special_holiday_nd_hours: pickHours(
      src,
      "Holiday_SpecialND_Hours",
      "Holiday_Special_ND_Hours",
      "special_holiday_nd_hours"
    ),
    special_holiday_ot_nd_hours: pickHours(
      src,
      "shotndh",
      "special_holiday_ot_nd_hours"
    ),
    rest_day_hours: pickHours(src, "rdhours", "RDhours", "rest_day_hours"),
    rest_day_ot_hours: pickHours(src, "RDothours", "rest_day_ot_hours"),
    rest_day_nd_hours: pickHours(src, "rdndhours", "rest_day_nd_hours"),
    rest_day_ot_nd_hours: pickHours(src, "rdotndh", "rest_day_ot_nd_hours"),
    lh_rest_day_hours: pickHours(src, "lhwdohours", "lh_rest_day_hours"),
    lh_rest_day_ot_hours: pickHours(src, "lhwdoothours", "lh_rest_day_ot_hours"),
    sh_rest_day_hours: pickHours(src, "shwdohours", "sh_rest_day_hours"),
    sh_rest_day_ot_hours: pickHours(src, "shwdoothours", "sh_rest_day_ot_hours"),
    wdo_hours: pickHours(src, "WDOhours", "wdo_hours"),
    tardiness_hours: pickHours(src, "tardiness", "tardiness_hours"),
    undertime_hours: pickHours(src, "undertime", "undertime_hours"),
    absences_hours: pickHours(src, "absences", "absences_hours"),
    pto_hours: pickHours(src, "pto", "pto_hours"),
    allowance: n(pick(src, "allowance", "allowancep")) || null,
    daily_rate_payroll: n(pick(src, "dailyrate_payroll")) || null,
    source_of_data: "GREENHRISMAIN",
    legacy_idtimekeep:
      legacyTk != null && Number.isFinite(Number(legacyTk))
        ? Math.trunc(Number(legacyTk))
        : null,
  };
}
