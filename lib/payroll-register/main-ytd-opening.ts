/**
 * Pick the latest MAIN payroll_summary accrual row per person/year
 * (catalog opening for 13th YTD / SIL).
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

export function latestAccrualOpenings(rows: MainAccrualRow[]): MainAccrualRow[] {
  const byKey = new Map<string, MainAccrualRow>();
  for (const row of rows) {
    const key = `${row.legacyClientId}:${row.legacyEmployeeId}:${row.year}`;
    const existing = byKey.get(key);
    if (!existing || row.periodEnd.slice(0, 10) > existing.periodEnd.slice(0, 10)) {
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
