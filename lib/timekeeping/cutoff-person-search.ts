import { escapeIlikePattern } from "@/lib/directory/employee-search";

/** Default columns on cutoff_hours / register-style person rows. */
export const CUTOFF_PERSON_SEARCH_COLUMNS = [
  "last_name",
  "first_name",
  "employee_code",
  "outlet",
] as const;

export const CUTOFF_REGISTER_SEARCH_COLUMNS = [
  "last_name",
  "first_name",
  "employee_code",
] as const;

function significantTokens(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function tokenOr(token: string, columns: readonly string[]): string {
  const pattern = escapeIlikePattern(token);
  return columns.map((col) => `${col}.ilike.%${pattern}%`).join(",");
}

/**
 * PostgREST `.or()` / nested `and(or(...))` for cutoff hours & register search.
 * Tokenizes so "Last, First" paste does not break comma-separated `.or()` syntax.
 */
export function cutoffPersonSearchFilter(
  q: string,
  columns: readonly string[] = CUTOFF_PERSON_SEARCH_COLUMNS
): string | null {
  const tokens = significantTokens(q);
  if (tokens.length === 0 || columns.length === 0) return null;

  const tokenOrs = tokens.map((token) => tokenOr(token, columns));
  if (tokenOrs.length === 1) return tokenOrs[0]!;
  return `and(${tokenOrs.map((clause) => `or(${clause})`).join(",")})`;
}
