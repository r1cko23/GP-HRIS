/** Cutoff picker helpers for Benefits deductions / allowances. */

export type BenefitsCutoffOption = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  client_id?: string | null;
};

/** Posted / closed cutoffs cannot receive new deductions or allowances. */
export function isBenefitsCutoffEditable(
  row: Pick<BenefitsCutoffOption, "status">
): boolean {
  const s = String(row.status || "").toLowerCase();
  return s !== "posted" && s !== "closed";
}

/** Hide locked cutoffs from the Benefits picker. */
export function listEditableBenefitsCutoffs(
  rows: BenefitsCutoffOption[]
): BenefitsCutoffOption[] {
  return rows.filter(isBenefitsCutoffEditable);
}

export function formatBenefitsCutoffLabel(row: BenefitsCutoffOption): string {
  const status = String(row.status || "").trim() || "open";
  return `${row.period_start} → ${row.period_end} (${status})`;
}

/** Prefer open/draft/pending/approved, then most recent period_end. */
export function pickDefaultBenefitsCutoff(
  rows: BenefitsCutoffOption[]
): BenefitsCutoffOption | null {
  const pool = listEditableBenefitsCutoffs(rows);
  if (!pool.length) return null;
  return [...pool].sort((a, b) =>
    b.period_end.localeCompare(a.period_end)
  )[0] ?? null;
}
