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
