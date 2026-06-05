/**
 * Unified Days Work / Hours Work calculation for timesheet and payslip.
 * Frappe HR pattern: one engine, multiple views.
 */

import type { DaysWorkInput, DaysWorkResult } from "./types";

const MAX_CUTOFF_HOURS = 104;

/**
 * Compute Days Work for a bi-monthly cutoff.
 * Used by Time Attendance and Payslip so both screens always match.
 */
export function computeDaysWork(params: DaysWorkInput): DaysWorkResult {
  const {
    basePayHours,
    actualTotalBH,
    renderedSpecialBH,
    excludeWorkedSpecialDayFromDaysWork,
  } = params;

  const totalBHForDaysWork = Math.min(
    MAX_CUTOFF_HOURS,
    excludeWorkedSpecialDayFromDaysWork
      ? Math.max(0, basePayHours - renderedSpecialBH)
      : Math.max(basePayHours, actualTotalBH)
  );

  return {
    totalBHForDaysWork,
    daysWorked: totalBHForDaysWork / 8,
  };
}
