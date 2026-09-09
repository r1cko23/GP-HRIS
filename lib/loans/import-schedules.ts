/**
 * Which GREENHRISMAIN unpaid schedule dates may be inserted into GP.
 * Paid and skipped rows occupy (loan_id, period_start) and must not be re-inserted.
 * Pending rows are replaced by the ETL (deleted, then inserted).
 */

export function planLoanImportSchedules(input: {
  unpaidPeriodStarts: string[];
  existing: Array<{ period_start: string; status: string }>;
  postedPeriodStarts: string[];
}): { insertStarts: string[] } {
  const posted = new Set(input.postedPeriodStarts.filter(Boolean));
  const occupied = new Set(
    input.existing
      .filter((row) => row.status === "paid" || row.status === "skipped")
      .map((row) => row.period_start)
      .filter(Boolean)
  );
  const insertStarts: string[] = [];
  const seen = new Set<string>();
  for (const start of input.unpaidPeriodStarts) {
    if (!start || seen.has(start)) continue;
    seen.add(start);
    if (posted.has(start) || occupied.has(start)) continue;
    insertStarts.push(start);
  }
  return { insertStarts };
}
