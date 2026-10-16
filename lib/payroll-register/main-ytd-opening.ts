/**
 * Pick the latest MAIN payroll_summary accrual row per person/year
 * (catalog opening for 13th YTD / SIL).
 *
 * MAIN adjustment runs often leave ytdthirteenmonth at 0. Do not let that
 * wipe a prior regular YTD — carry it forward and add this row's 13th cutoff.
 */

export type MainAccrualRow = {
  legacyEmployeeId: number;
  legacyClientId: number;
  periodStart: string;
  periodEnd: string;
  basic: number;
  thirteenthMonth: number;
  thirteenthMonthYtd: number;
  silCutoff: number;
  year: number;
  lastName: string;
  firstName: string;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** When MAIN left YTD at 0 on a later kinsena (common on adjustments), keep prior YTD. */
export function mergeAccrualOpeningYtd(
  later: MainAccrualRow,
  earlier: MainAccrualRow | null
): number {
  const laterYtd = n(later.thirteenthMonthYtd);
  if (laterYtd > 0) return laterYtd;
  if (!earlier) return laterYtd;
  const priorYtd = n(earlier.thirteenthMonthYtd);
  if (priorYtd <= 0) return laterYtd;
  return round2(priorYtd + n(later.thirteenthMonth));
}

export function latestAccrualOpenings(rows: MainAccrualRow[]): MainAccrualRow[] {
  const byKey = new Map<string, MainAccrualRow>();
  for (const row of rows) {
    const key = `${row.legacyClientId}:${row.legacyEmployeeId}:${row.year}`;
    const existing = byKey.get(key);
    const end = row.periodEnd.slice(0, 10);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingEnd = existing.periodEnd.slice(0, 10);
    if (end > existingEnd) {
      byKey.set(key, {
        ...row,
        thirteenthMonthYtd: mergeAccrualOpeningYtd(row, existing),
      });
    } else if (end < existingEnd) {
      // Older row arrived after a newer one — back-fill YTD if the newer was 0.
      byKey.set(key, {
        ...existing,
        thirteenthMonthYtd: mergeAccrualOpeningYtd(existing, row),
      });
    } else if (n(row.thirteenthMonthYtd) > n(existing.thirteenthMonthYtd)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function openingToScrapedAccrual(row: MainAccrualRow): {
  name: string;
  thirteenthMonthCutoff: number;
  thirteenthMonthYTD: number;
  silCutoff: number;
} {
  const name = [row.lastName, row.firstName].filter(Boolean).join(", ");
  return {
    name,
    thirteenthMonthCutoff: row.thirteenthMonth,
    thirteenthMonthYTD: row.thirteenthMonthYtd,
    silCutoff: row.silCutoff,
  };
}
