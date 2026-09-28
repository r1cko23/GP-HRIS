/** Cutoff picker helpers for Benefits deductions / allowances. */

export type BenefitsCutoffOption = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  client_id?: string | null;
};

export function formatBenefitsCutoffLabel(row: BenefitsCutoffOption): string {
  const status = String(row.status || "").trim() || "open";
  return `${row.period_start} → ${row.period_end} (${status})`;
}

/** Prefer open/draft, then most recent period_end. */
export function pickDefaultBenefitsCutoff(
  rows: BenefitsCutoffOption[]
): BenefitsCutoffOption | null {
  if (!rows.length) return null;
  const preferred = rows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s !== "posted" && s !== "closed";
  });
  const pool = preferred.length ? preferred : rows;
  return [...pool].sort((a, b) =>
    b.period_end.localeCompare(a.period_end)
  )[0] ?? null;
}
