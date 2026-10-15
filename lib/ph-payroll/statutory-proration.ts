/**
 * MAIN-style statutory proration when a cutoff is shorter than a full kinsena
 * (e.g. SMXCC weekly 16–25 vs calendar 16–30): SSS / PhilHealth / Pag-IBIG
 * × daysWork/13; SSS snaps onto ₱25.
 */

import {
  cutoffWindowKind,
  normalizePayFrequency,
  windowsForMonth,
  type ClientPayCalendar,
} from "@/lib/directory/client-pay-calendar";

const KINSENA_DAYS = 13;

const round2 = (n: number) => Math.round(n * 100) / 100;

function parseYmd(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** True when this cutoff is not a full kinsena window (weekly or short period_end). */
export function cutoffNeedsStatutoryProration(
  calendar: ClientPayCalendar,
  periodStart: string,
  periodEnd: string,
  cutoffPayFrequency?: string | null
): boolean {
  if (normalizePayFrequency(cutoffPayFrequency) === "weekly") return true;

  const start = periodStart.slice(0, 10);
  const end = periodEnd.slice(0, 10);
  const { year, month } = parseYmd(start);
  const match = windowsForMonth(calendar, year, month).find(
    (w) => w.period_start === start
  );
  if (match) return match.period_end !== end;

  // No calendar match: treat as short if end day is before the window's usual end.
  const kind = cutoffWindowKind(calendar, start);
  if (kind === "other") return true;
  const fallback = windowsForMonth(calendar, year, month).find(
    (w) => w.window === kind
  );
  return fallback ? fallback.period_end !== end : false;
}

/** Cap at 1 so a long week never exceeds a full kinsena half. */
export function statutoryProrationFactor(
  daysWorked: number,
  needsProration: boolean
): number {
  if (!needsProration) return 1;
  const days = Math.max(0, Number(daysWorked) || 0);
  return Math.min(1, days / KINSENA_DAYS);
}

export function applyStatutoryProration(
  amount: number,
  factor: number,
  opts?: { snap?: number }
): number {
  const base = Number(amount) || 0;
  if (!(factor > 0) || !(base > 0)) return 0;
  if (factor >= 1) return round2(base);
  const raw = base * factor;
  const snap = opts?.snap;
  if (snap && snap > 0) {
    return Math.round(raw / snap) * snap;
  }
  return round2(raw);
}
