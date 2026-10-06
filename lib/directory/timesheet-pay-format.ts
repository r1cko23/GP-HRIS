/** Timesheet size for one Directory Site. Copied onto a cutoff when it opens. */

export const TIMESHEET_PAY_FORMATS = [0, 7, 10, 11, 12, 13] as const;

export type TimesheetPayFormat = (typeof TIMESHEET_PAY_FORMATS)[number];

export function parseTimesheetPayFormat(value: unknown): TimesheetPayFormat | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed)) return null;
  if (!(TIMESHEET_PAY_FORMATS as readonly number[]).includes(parsed)) return null;
  return parsed as TimesheetPayFormat;
}

export function timesheetPayFormatLabel(format: number | null | undefined): string {
  if (format == null) return "Not set";
  if (format === 0) return "Daily — no fixed workday cap";
  if (format === 7) return "Weekly — 7 rows, 56 regular hours";
  return `${format} workdays — ${format * 8} regular hours`;
}
