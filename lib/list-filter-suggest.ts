/** Shared list-filter typeahead: match + capped suggestions. */

export type ListSuggestOption = {
  id: string;
  primary: string;
  secondary?: string;
  /** Applied to the search field when picked */
  value: string;
  /** Extra haystack beyond primary / secondary / value */
  matchText?: string;
};

const DEFAULT_LIMIT = 10;

export function matchListSuggestOption(
  query: string,
  option: ListSuggestOption
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const hay = [option.primary, option.secondary, option.value, option.matchText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** In-memory typeahead (≥ minChars, capped). Default minChars=1. */
export function suggestListOptions(
  options: ListSuggestOption[],
  query: string,
  opts?: { limit?: number; minChars?: number }
): ListSuggestOption[] {
  const q = query.trim();
  const minChars = opts?.minChars ?? 1;
  const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), 20);
  if (q.length < minChars) return [];
  const hits: ListSuggestOption[] = [];
  for (const opt of options) {
    if (!matchListSuggestOption(q, opt)) continue;
    hits.push(opt);
    if (hits.length >= limit) break;
  }
  return hits;
}
