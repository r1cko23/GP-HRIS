/**
 * Standing allowances for Organic/Deployed register.
 * Deployed: TL allowance (Epicurean, PLK).
 * Organic: Load + Supervisory.
 */

export const ALLOWANCE_KEYS = [
  "tl_allowance",
  "load_allowance",
  "supervisory_allowance",
] as const;

export type AllowanceKey = (typeof ALLOWANCE_KEYS)[number];

export type AllowanceScope = "organic" | "deployed";

export const ALLOWANCE_LABELS: Record<AllowanceKey, string> = {
  tl_allowance: "TL allowance",
  load_allowance: "Load allowance",
  supervisory_allowance: "Supervisory allowance",
};

/** Deployed site clients that use TL allowance (Epicurean, PLK). */
export const DEPLOYED_TL_ALLOWANCE_KEYS = [
  "tl_allowance",
] as const satisfies readonly AllowanceKey[];

/** Organic house allowances. */
export const ORGANIC_ALLOWANCE_KEYS = [
  "load_allowance",
  "supervisory_allowance",
] as const satisfies readonly AllowanceKey[];

export type AllowanceLine = {
  key: AllowanceKey;
  particular: string;
  amount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isAllowanceKey(value: string): value is AllowanceKey {
  return (ALLOWANCE_KEYS as readonly string[]).includes(value);
}

export function allowanceScopeFromOrgName(
  name: string | null | undefined
): AllowanceScope {
  return (name ?? "").toLowerCase().includes("organic")
    ? "organic"
    : "deployed";
}

export function allowanceKeysForScope(
  scope: AllowanceScope
): readonly AllowanceKey[] {
  return scope === "organic"
    ? ORGANIC_ALLOWANCE_KEYS
    : DEPLOYED_TL_ALLOWANCE_KEYS;
}

export function buildAllowanceLines(
  amounts: Partial<Record<string, number | null | undefined>>,
  keys: readonly AllowanceKey[] = ALLOWANCE_KEYS
): AllowanceLine[] {
  const out: AllowanceLine[] = [];
  for (const key of keys) {
    const amount = round2(Number(amounts[key] ?? 0));
    if (!(amount > 0)) continue;
    out.push({
      key,
      particular: ALLOWANCE_LABELS[key],
      amount,
    });
  }
  return out;
}

export function sumAllowanceLines(
  lines: AllowanceLine[] | null | undefined
): number {
  let total = 0;
  for (const line of lines ?? []) {
    const amount = round2(Number(line.amount ?? 0));
    if (amount > 0) total = round2(total + amount);
  }
  return total;
}

/** Compact printable labels for landscape payroll summary PDF/XLSX. */
export const ALLOWANCE_PDF_LABELS: Record<AllowanceKey, string> = {
  tl_allowance: "TL",
  load_allowance: "Load",
  supervisory_allowance: "Superv.",
};

/** Sum standing allowance lines across people, keyed in catalog order. */
export function aggregateAllowanceLinesByKey(
  lines: Array<{ allowance_lines?: AllowanceLine[] | null } | null | undefined>
): AllowanceLine[] {
  const totals = new Map<AllowanceKey, number>();
  for (const row of lines) {
    for (const item of row?.allowance_lines ?? []) {
      if (!isAllowanceKey(item.key)) continue;
      const amount = round2(Number(item.amount ?? 0));
      if (!(amount > 0)) continue;
      totals.set(item.key, round2((totals.get(item.key) ?? 0) + amount));
    }
  }
  const out: AllowanceLine[] = [];
  for (const key of ALLOWANCE_KEYS) {
    const amount = totals.get(key) ?? 0;
    if (!(amount > 0)) continue;
    out.push({
      key,
      particular: ALLOWANCE_LABELS[key],
      amount,
    });
  }
  return out;
}

export function allowanceAmountForKey(
  lines: AllowanceLine[] | null | undefined,
  key: AllowanceKey
): number {
  let total = 0;
  for (const line of lines ?? []) {
    if (line.key !== key) continue;
    const amount = round2(Number(line.amount ?? 0));
    if (amount > 0) total = round2(total + amount);
  }
  return total;
}

export function presentAllowanceKeys(
  lines: Array<{ allowance_lines?: AllowanceLine[] | null } | null | undefined>
): AllowanceKey[] {
  return aggregateAllowanceLinesByKey(lines).map((row) => row.key);
}
