/**
 * DOLE / NWPC premium multipliers (Organic cutoff hours + weekly day-type adapter).
 * ND-on-day and ND-on-OT rows are differentials (parent day/OT already paid).
 * Combo first-8 rows (LH/SH on rest) are full rates.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export const PREMIUM_RATES = {
  regular: 1,
  overtime: 1.25,
  night_diff: 0.1,
  /** Full night-OT rate when the NDOT bucket is exclusive (MAIN). */
  regular_night_ot: 1.375,
  legal_holiday: 2,
  legal_holiday_ot: 2.6,
  /** 10% of LH 200% when LH hours already paid at 2.0 → night total 220%. */
  legal_holiday_nd: 0.2,
  /** 10% of LH OT 260% → night OT total 286%. */
  legal_holiday_ot_nd: 0.26,
  special_holiday: 1.3,
  special_holiday_ot: 1.69,
  /** 10% of SH 130% → night total 143%. */
  special_holiday_nd: 0.13,
  /** 10% of SH OT 169% → night OT total 185.9%. */
  special_holiday_ot_nd: 0.169,
  rest_day: 1.3,
  rest_day_ot: 1.69,
  rest_day_nd: 0.13,
  rest_day_ot_nd: 0.169,
  /** Regular holiday falling on rest day (first 8). */
  lh_rest_day: 2.6,
  lh_rest_day_ot: 3.38,
  /** Special day falling on rest day (first 8). */
  sh_rest_day: 1.5,
  sh_rest_day_ot: 1.95,
  wdo: 1.3,
  pto: 1,
} as const;

/** Weekly day-type labels used by Office attendance. Combo days are not cutoff_hours buckets. */
export const PAYROLL_MULTIPLIERS = {
  REGULAR: PREMIUM_RATES.regular,
  REGULAR_OT: PREMIUM_RATES.overtime,
  REST_DAY: PREMIUM_RATES.rest_day,
  SPECIAL_HOLIDAY: PREMIUM_RATES.special_holiday,
  REGULAR_HOLIDAY: PREMIUM_RATES.legal_holiday,
  SUNDAY_SPECIAL_HOLIDAY: PREMIUM_RATES.sh_rest_day,
  /** First 8 on regular holiday that falls on rest day (not OT). */
  SUNDAY_REGULAR_HOLIDAY: PREMIUM_RATES.lh_rest_day,
  OT_PREMIUM: 1.3,
  NIGHT_DIFF: PREMIUM_RATES.night_diff,
  /** Top-up when OT already paid at 1.25 (GP-Client / office day overlap). */
  REGULAR_NIGHT_OT_TOP_UP:
    PREMIUM_RATES.regular_night_ot - PREMIUM_RATES.overtime,
} as const;

export type CutoffHoursRow = {
  id: string;
  directory_employee_id: string | null;
  office_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  daily_rate_payroll: number | string | null;
  /** GP-Client embeds NDOT hours inside overtime_hours; MAIN keeps them exclusive. */
  source_of_data?: string | null;
  actual_regular_hours?: number | string | null;
  hours_work?: number | string | null;
  overtime_hours?: number | string | null;
  night_diff_hours?: number | string | null;
  regular_night_ot_hours?: number | string | null;
  legal_holiday_hours?: number | string | null;
  legal_holiday_ot_hours?: number | string | null;
  legal_holiday_nd_hours?: number | string | null;
  legal_holiday_ot_nd_hours?: number | string | null;
  special_holiday_hours?: number | string | null;
  special_holiday_ot_hours?: number | string | null;
  special_holiday_nd_hours?: number | string | null;
  special_holiday_ot_nd_hours?: number | string | null;
  rest_day_hours?: number | string | null;
  rest_day_ot_hours?: number | string | null;
  rest_day_nd_hours?: number | string | null;
  rest_day_ot_nd_hours?: number | string | null;
  lh_rest_day_hours?: number | string | null;
  lh_rest_day_ot_hours?: number | string | null;
  sh_rest_day_hours?: number | string | null;
  sh_rest_day_ot_hours?: number | string | null;
  wdo_hours?: number | string | null;
  pto_hours?: number | string | null;
  allowance?: number | string | null;
  tardiness_hours?: number | string | null;
  undertime_hours?: number | string | null;
  absences_hours?: number | string | null;
};

function hourlyFromDaily(dailyRate: number): number {
  return dailyRate > 0 ? dailyRate / 8 : 0;
}

export function computeEarningsFromHours(
  row: CutoffHoursRow,
  dailyRate: number
): { earnings: Record<string, number>; gross: number; hours: Record<string, number> } {
  const hourly = hourlyFromDaily(dailyRate);
  const hours = {
    actual_regular_hours: n(row.actual_regular_hours),
    overtime_hours: n(row.overtime_hours),
    night_diff_hours: n(row.night_diff_hours),
    regular_night_ot_hours: n(row.regular_night_ot_hours),
    legal_holiday_hours: n(row.legal_holiday_hours),
    legal_holiday_ot_hours: n(row.legal_holiday_ot_hours),
    legal_holiday_nd_hours: n(row.legal_holiday_nd_hours),
    legal_holiday_ot_nd_hours: n(row.legal_holiday_ot_nd_hours),
    special_holiday_hours: n(row.special_holiday_hours),
    special_holiday_ot_hours: n(row.special_holiday_ot_hours),
    special_holiday_nd_hours: n(row.special_holiday_nd_hours),
    special_holiday_ot_nd_hours: n(row.special_holiday_ot_nd_hours),
    rest_day_hours: n(row.rest_day_hours),
    rest_day_ot_hours: n(row.rest_day_ot_hours),
    rest_day_nd_hours: n(row.rest_day_nd_hours),
    rest_day_ot_nd_hours: n(row.rest_day_ot_nd_hours),
    lh_rest_day_hours: n(row.lh_rest_day_hours),
    lh_rest_day_ot_hours: n(row.lh_rest_day_ot_hours),
    sh_rest_day_hours: n(row.sh_rest_day_hours),
    sh_rest_day_ot_hours: n(row.sh_rest_day_ot_hours),
    wdo_hours: n(row.wdo_hours),
    pto_hours: n(row.pto_hours),
    tardiness_hours: n(row.tardiness_hours),
    undertime_hours: n(row.undertime_hours),
    absences_hours: n(row.absences_hours),
    hours_work: n(row.hours_work),
  };

  // GP-Client puts NDOT hours inside overtime_hours (already paid at 1.25).
  // NDOT amount is only the top-up to 1.375. MAIN keeps exclusive buckets → full 1.375.
  const ndotInsideOt = String(row.source_of_data ?? "")
    .toUpperCase()
    .includes("GP-CLIENT");
  const ndotMultiplier = ndotInsideOt
    ? PREMIUM_RATES.regular_night_ot - PREMIUM_RATES.overtime
    : PREMIUM_RATES.regular_night_ot;

  const earnings: Record<string, number> = {
    basic: round2(hours.actual_regular_hours * hourly * PREMIUM_RATES.regular),
    overtime: round2(hours.overtime_hours * hourly * PREMIUM_RATES.overtime),
    night_diff: round2(hours.night_diff_hours * hourly * PREMIUM_RATES.night_diff),
    regular_night_ot: round2(
      hours.regular_night_ot_hours * hourly * ndotMultiplier
    ),
    legal_holiday: round2(
      hours.legal_holiday_hours * hourly * PREMIUM_RATES.legal_holiday
    ),
    legal_holiday_ot: round2(
      hours.legal_holiday_ot_hours * hourly * PREMIUM_RATES.legal_holiday_ot
    ),
    legal_holiday_nd: round2(
      hours.legal_holiday_nd_hours * hourly * PREMIUM_RATES.legal_holiday_nd
    ),
    legal_holiday_ot_nd: round2(
      hours.legal_holiday_ot_nd_hours *
        hourly *
        PREMIUM_RATES.legal_holiday_ot_nd
    ),
    special_holiday: round2(
      hours.special_holiday_hours * hourly * PREMIUM_RATES.special_holiday
    ),
    special_holiday_ot: round2(
      hours.special_holiday_ot_hours * hourly * PREMIUM_RATES.special_holiday_ot
    ),
    special_holiday_nd: round2(
      hours.special_holiday_nd_hours * hourly * PREMIUM_RATES.special_holiday_nd
    ),
    special_holiday_ot_nd: round2(
      hours.special_holiday_ot_nd_hours *
        hourly *
        PREMIUM_RATES.special_holiday_ot_nd
    ),
    rest_day: round2(hours.rest_day_hours * hourly * PREMIUM_RATES.rest_day),
    rest_day_ot: round2(
      hours.rest_day_ot_hours * hourly * PREMIUM_RATES.rest_day_ot
    ),
    rest_day_nd: round2(
      hours.rest_day_nd_hours * hourly * PREMIUM_RATES.rest_day_nd
    ),
    rest_day_ot_nd: round2(
      hours.rest_day_ot_nd_hours * hourly * PREMIUM_RATES.rest_day_ot_nd
    ),
    lh_rest_day: round2(
      hours.lh_rest_day_hours * hourly * PREMIUM_RATES.lh_rest_day
    ),
    lh_rest_day_ot: round2(
      hours.lh_rest_day_ot_hours * hourly * PREMIUM_RATES.lh_rest_day_ot
    ),
    sh_rest_day: round2(
      hours.sh_rest_day_hours * hourly * PREMIUM_RATES.sh_rest_day
    ),
    sh_rest_day_ot: round2(
      hours.sh_rest_day_ot_hours * hourly * PREMIUM_RATES.sh_rest_day_ot
    ),
    wdo: round2(hours.wdo_hours * hourly * PREMIUM_RATES.wdo),
    pto: round2(hours.pto_hours * hourly * PREMIUM_RATES.pto),
    allowance: round2(n(row.allowance)),
  };

  // Late / UT / absence hours are already baked into actual_regular_hours by
  // GP-Client format-cap (and MAIN pays on noofhourswork with no second deduct).
  // Keep the memo bucket at 0 so gross is not double-counted.
  earnings.tardiness_undertime_absence = 0;

  const gross = round2(Object.values(earnings).reduce((acc, v) => acc + v, 0));

  return { earnings, gross: Math.max(0, gross), hours };
}
