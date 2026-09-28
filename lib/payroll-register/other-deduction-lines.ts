/**
 * Itemized other deductions for Organic/Deployed register remittance.
 * Keys map to GREENHRISMAIN otherdeduction.particular labels.
 *
 * Deployed: PA, BDO Insurance, HMO, Uniform, Nameplate, ID
 * Organic: PA, BDO Insurance, HMO only
 */

export const OTHER_DEDUCTION_KEYS = [
  "personal_accident",
  "bdo_insurance",
  "hmo",
  "uniform",
  "nameplate",
  "id_card",
] as const;

export type OtherDeductionKey = (typeof OTHER_DEDUCTION_KEYS)[number];

export type OtherDeductionScope = "organic" | "deployed";

/** Organic house — three remittance particulars only. */
export const ORGANIC_OTHER_DEDUCTION_KEYS = [
  "personal_accident",
  "bdo_insurance",
  "hmo",
] as const satisfies readonly OtherDeductionKey[];

/** Deployed sites — full itemized set. */
export const DEPLOYED_OTHER_DEDUCTION_KEYS = OTHER_DEDUCTION_KEYS;

export const OTHER_DEDUCTION_LABELS: Record<OtherDeductionKey, string> = {
  personal_accident: "Personal Accident",
  bdo_insurance: "BDO Insurance",
  hmo: "HMO",
  uniform: "Uniform",
  nameplate: "Nameplate",
  id_card: "ID",
};

export type OtherDeductionLine = {
  key: OtherDeductionKey;
  particular: string;
  amount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function isOtherDeductionKey(value: string): value is OtherDeductionKey {
  return (OTHER_DEDUCTION_KEYS as readonly string[]).includes(value);
}

export function otherDeductionScopeFromOrgName(
  name: string | null | undefined
): OtherDeductionScope {
  return (name ?? "").toLowerCase().includes("organic")
    ? "organic"
    : "deployed";
}

export function otherDeductionKeysForScope(
  scope: OtherDeductionScope
): readonly OtherDeductionKey[] {
  return scope === "organic"
    ? ORGANIC_OTHER_DEDUCTION_KEYS
    : DEPLOYED_OTHER_DEDUCTION_KEYS;
}

export function otherDeductionParticular(key: OtherDeductionKey): string {
  return OTHER_DEDUCTION_LABELS[key];
}

/** Build positive itemized lines from a key→amount map (UI / standing file). */
export function buildOtherDeductionLines(
  amounts: Partial<Record<string, number | null | undefined>>,
  keys: readonly OtherDeductionKey[] = OTHER_DEDUCTION_KEYS
): OtherDeductionLine[] {
  const out: OtherDeductionLine[] = [];
  for (const key of keys) {
    const amount = round2(Number(amounts[key] ?? 0));
    if (!(amount > 0)) continue;
    out.push({
      key,
      particular: OTHER_DEDUCTION_LABELS[key],
      amount,
    });
  }
  return out;
}

export function sumOtherDeductionLines(
  lines: OtherDeductionLine[] | null | undefined
): number {
  let total = 0;
  for (const line of lines ?? []) {
    const amount = round2(Number(line.amount ?? 0));
    if (amount > 0) total = round2(total + amount);
  }
  return total;
}
