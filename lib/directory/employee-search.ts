/** Pure Directory employee `q` matching helpers (GP-HRIS list API). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Escape `%`, `_`, and `\` for PostgREST / SQL ILIKE patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Philippine SSS is often stored dashed (XX-XXXXXXX-X) or digits-only.
 * Search must try both when the query is digit-heavy.
 */
export function phSssSearchForms(raw: string): string[] {
  const digits = digitsOnly(raw);
  const forms: string[] = [];
  const add = (value: string) => {
    if (value && !forms.includes(value)) forms.push(value);
  };
  add(raw.trim());
  if (digits.length >= 4) add(digits);
  if (digits.length === 10) {
    add(`${digits.slice(0, 2)}-${digits.slice(2, 9)}-${digits.slice(9)}`);
  }
  return forms;
}

export function phTinSearchForms(raw: string): string[] {
  const digits = digitsOnly(raw);
  const forms: string[] = [];
  const add = (value: string) => {
    if (value && !forms.includes(value)) forms.push(value);
  };
  add(raw.trim());
  if (digits.length >= 4) add(digits);
  if (digits.length === 9) {
    add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  }
  if (digits.length === 12) {
    add(
      `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`
    );
  }
  return forms;
}

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

/**
 * Build PostgREST `.or()` clause strings for one token (name / code fields).
 */
export function directoryEmployeeNameTokenOr(token: string): string {
  const pattern = escapeIlikePattern(token);
  return [
    `last_name.ilike.%${pattern}%`,
    `first_name.ilike.%${pattern}%`,
    `middle_name.ilike.%${pattern}%`,
    `employee_code.ilike.%${pattern}%`,
  ].join(",");
}

function identityOrClause(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length < 4) return null;
  const idParts: string[] = [];
  for (const form of phSssSearchForms(raw)) {
    idParts.push(`sss_number.ilike.%${escapeIlikePattern(form)}%`);
  }
  for (const form of phTinSearchForms(raw)) {
    idParts.push(`tin.ilike.%${escapeIlikePattern(form)}%`);
  }
  return idParts.length > 0 ? idParts.join(",") : null;
}

/**
 * Single PostgREST `or=(...)` argument for Directory employee list search.
 * - Multi-word: every token must hit some name/code field.
 * - Digit-heavy: SSS/TIN match dashed or plain forms.
 * - Optional employee_code alias ids are OR'd with the name/id match.
 */
export function directoryEmployeeSearchFilter(
  q: string,
  aliasIds: string[] = []
): string | null {
  const trimmed = q.trim();
  const aliases =
    aliasIds.length > 0 ? `id.in.(${aliasIds.join(",")})` : null;
  if (!trimmed) return aliases;

  const digits = digitsOnly(trimmed);
  const mostlyId = digits.length >= 4 && !/[a-zA-Z]/.test(trimmed);
  if (mostlyId) {
    const identity = identityOrClause(trimmed);
    if (!identity) return aliases;
    return aliases ? `${identity},${aliases}` : identity;
  }

  const tokens = significantTokens(trimmed);
  if (tokens.length === 0) return aliases;

  const tokenOrs = tokens.map((token) => directoryEmployeeNameTokenOr(token));
  let nameFilter: string;
  if (tokenOrs.length === 1) {
    nameFilter = tokenOrs[0]!;
  } else {
    nameFilter = `and(${tokenOrs.map((clause) => `or(${clause})`).join(",")})`;
  }

  if (aliases) return `${nameFilter},${aliases}`;
  return nameFilter;
}

/** @deprecated Prefer directoryEmployeeSearchFilter — kept for focused unit tests. */
export function directoryEmployeeSearchOrClauses(q: string): string[] {
  const filter = directoryEmployeeSearchFilter(q);
  if (!filter) return [];
  if (filter.startsWith("and(")) {
    // Unwrap and(or(a),or(b)) for assertion helpers — return inner token ORs.
    const tokens = significantTokens(q);
    return tokens.map((token) => directoryEmployeeNameTokenOr(token));
  }
  return [filter];
}
