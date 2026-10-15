/**
 * Register search / pay-filter must drive summary + totals from every matching
 * line — not the paged slice and not the unfiltered run.
 */

export function linesForRegisterSummary<T>(input: {
  filtersActive: boolean;
  matchingLines: T[];
  allLines: T[];
}): T[] {
  return input.filtersActive ? input.matchingLines : input.allLines;
}

export function registerListFiltersActive(input: {
  q?: string | null;
  payFilter?: string | null;
}): boolean {
  const q = input.q?.trim();
  const pay = input.payFilter?.trim() || "all";
  return Boolean(q) || pay !== "all";
}
