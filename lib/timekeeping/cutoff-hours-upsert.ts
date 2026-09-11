/**
 * cutoff_hours upsert / dedupe: period + person + position + outlet
 * (UNIQUE NULLS NOT DISTINCT). Dual-position and dual-outlet stay separate.
 */

export const CUTOFF_HOURS_UPSERT_ON_CONFLICT =
  "cutoff_period_id,directory_employee_id,position_id,outlet";

const HOUR_SUM_KEYS = [
  "actual_regular_hours",
  "hours_work",
  "overtime_hours",
  "night_diff_hours",
  "legal_holiday_hours",
  "legal_holiday_ot_hours",
  "special_holiday_hours",
  "special_holiday_ot_hours",
  "rest_day_hours",
  "rest_day_ot_hours",
  "pto_hours",
] as const;

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function personPositionKey(row: Record<string, unknown>): string {
  const outlet = String(row.outlet ?? "").trim().toLowerCase();
  return `${String(row.directory_employee_id)}|${row.position_id == null ? "" : String(row.position_id)}|${outlet}`;
}

/** Collapse duplicate office→Directory links; keep dual-position rows separate. */
export function dedupeCutoffHoursRowsByPersonPosition(
  hourRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of hourRows) {
    const key = personPositionKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row });
      continue;
    }
    for (const field of HOUR_SUM_KEYS) {
      prev[field] = num(prev[field]) + num(row[field]);
    }
  }
  return [...byKey.values()];
}
