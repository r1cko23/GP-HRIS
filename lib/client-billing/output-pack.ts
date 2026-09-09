/**
 * Client-safe billing pack enum — no PDF / fs imports.
 * Keep UI and form helpers on this module; file builders stay in outputs.ts.
 */

export const BILLING_OUTPUT_PACKS = [
  "generic",
  "aldex",
  "plk",
  "debit_memo",
] as const;

export type BillingOutputPack = (typeof BILLING_OUTPUT_PACKS)[number];

export function parseBillingOutputPack(value: unknown): BillingOutputPack {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "aldex" || raw === "plk" || raw === "debit_memo") return raw;
  return "generic";
}
