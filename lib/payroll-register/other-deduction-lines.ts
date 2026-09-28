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

/** Compact printable labels for landscape payroll summary PDF/XLSX. */
export const OTHER_DEDUCTION_PDF_LABELS: Record<OtherDeductionKey, string> = {
  personal_accident: "PA",
  bdo_insurance: "BDO Ins.",
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

/** Sum itemized other-deduction lines across people, keyed in catalog order. */
export function aggregateOtherDeductionLinesByKey(
  lines: Array<{ other_deduction_lines?: OtherDeductionLine[] | null } | null | undefined>
): OtherDeductionLine[] {
  const totals = new Map<OtherDeductionKey, number>();
  for (const row of lines) {
    for (const item of row?.other_deduction_lines ?? []) {
      if (!isOtherDeductionKey(item.key)) continue;
      const amount = round2(Number(item.amount ?? 0));
      if (!(amount > 0)) continue;
      totals.set(item.key, round2((totals.get(item.key) ?? 0) + amount));
    }
  }
  const out: OtherDeductionLine[] = [];
  for (const key of OTHER_DEDUCTION_KEYS) {
    const amount = totals.get(key) ?? 0;
    if (!(amount > 0)) continue;
    out.push({
      key,
      particular: OTHER_DEDUCTION_LABELS[key],
      amount,
    });
  }
  return out;
}

/** Amount for one particular on a single register line (0 when absent). */
export function otherDeductionAmountForKey(
  lines: OtherDeductionLine[] | null | undefined,
  key: OtherDeductionKey
): number {
  let total = 0;
  for (const line of lines ?? []) {
    if (line.key !== key) continue;
    const amount = round2(Number(line.amount ?? 0));
    if (amount > 0) total = round2(total + amount);
  }
  return total;
}

/** Keys that appear with a positive amount anywhere in the run (catalog order). */
export function presentOtherDeductionKeys(
  lines: Array<{ other_deduction_lines?: OtherDeductionLine[] | null } | null | undefined>
): OtherDeductionKey[] {
  return aggregateOtherDeductionLinesByKey(lines).map((row) => row.key);
}
