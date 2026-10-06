/**
 * SIL monthly-run pay method, per client.
 * Casual/on-call: days/26 × 5/12 × daily rate (hotel sheet).
 * Full 313: days/313 × 5 × daily rate, paid on the hire anniversary.
 */

import { SIL_WORKING_DAYS } from "@/lib/reports/sil-cutoff-accrual";

export const SIL_PAY_METHODS = [
  "casual_prorated",
  "full_313_anniversary",
] as const;

export type SilPayMethod = (typeof SIL_PAY_METHODS)[number];

const LABELS: Record<SilPayMethod, string> = {
  casual_prorated: "Casual/On-call — pro-rated",
  full_313_anniversary: "Full 313 — upon anniversary",
};

/** Directory legal names and the payroll-sheet aliases that mean the same client. */
const CASUAL_NAMES = [
  "Admiral Hotel",
  "Conrad Hotel",
  "Sm Prime Holdings Inc.-Conrad Hotel",
  "Deluxe Hotels and Recreation Inc",
  "Deluxe Hotels And Recreation Inc-Manila Hilton Hotel",
  "Melco Resorts Leisure (Philippines) Corp",
  "Melco Resorts Leisure (Php) Corp- City Of Dreams",
  "Rockwell Hotel & Leisure Management Corporation",
  "Rockwell Hotel & Leisure Management Corp-Aruga By Rockwell",
  "Sm Prime Holdings Inc - Lanson Place",
  "Sm Prime Holdings Inc.-Lanson Place",
  "Sm Prime Holdings Inc - Pico Beach Club",
  "Pico De Loro Beach And Country Club Inc.",
  "Sm Prime Holdings Inc - Pico Sands Hotel",
  "Sm Prime Holdings Inc.-Pico De Loro",
  "Sm Prime Holdings Inc - Taal Vista Hotel",
  "Sm Prime Holdings Inc-Taal Vistal Hotel",
  "Smx Convention Specialist Corp",
  "Sm Prime Holdings Inc.-Smxcc",
  "Tiger Resort Leisure & Entertainment Inc",
  "Tiger Resort Leisure And Entertainment Inc-Okada Manila",
];

const FULL_313_NAMES = [
  "Aldex Realty Corp.",
  "Aldex Realty Corporation",
  "Sm Development Corp",
  "Sm Development Corporation",
  "Berjaya (Paris Baguette)",
  "Berjaya Paris Baguette Phils Inc.",
  "Chicha Hut Food Corp",
  "Chicha Hut Food Corp.",
  "Comclark Network & Tech Info Corp",
  "Comclark Network & Technology Info. Corp.",
  "Converge Info. & Communication Tech. Info",
  "Converge Info And Communications Tech Solutions Inc",
  "Epicurean Partners Exchange Inc",
  "Goldilocks Bakeshop Inc",
  "Goldilocks Bakeshop Inc.",
  "Nikkei Group Inc.",
  "Nikkei Global City Inc.",
  "Popeyes Louisiana Kitchen Philippines Inc",
  "Plk Phils. Inc",
  "Teishoku Dining Concepts Inc",
  "Teishoku Dining Concepts Inc.",
  "Teppanya Group",
  "Teppanya Restuarant Alabang Inc",
  "Vouno Trade & Marketing Services Corp",
  "Vouno Trade & Marketing Services, Corp.",
];

function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalog(): Map<string, SilPayMethod> {
  const map = new Map<string, SilPayMethod>();
  for (const name of CASUAL_NAMES) {
    map.set(normalizeClientName(name), "casual_prorated");
  }
  for (const name of FULL_313_NAMES) {
    map.set(normalizeClientName(name), "full_313_anniversary");
  }
  return map;
}

const BY_NAME = catalog();

export function parseSilPayMethod(value: unknown): SilPayMethod | null {
  const raw = String(value ?? "").trim();
  if ((SIL_PAY_METHODS as readonly string[]).includes(raw)) {
    return raw as SilPayMethod;
  }
  return null;
}

/**
 * Stored column wins. Otherwise the payroll-sheet name catalog.
 * Null means this client is not on the sheet and has no stored method.
 */
export function resolveSilPayMethod(
  clientName: string | null | undefined,
  stored?: unknown
): SilPayMethod | null {
  const explicit = parseSilPayMethod(stored);
  if (explicit) return explicit;
  const key = normalizeClientName(String(clientName ?? ""));
  if (!key) return null;
  return BY_NAME.get(key) ?? null;
}

export function silPayMethodForRun(
  clientName: string | null | undefined,
  stored?: unknown
): { method: SilPayMethod; assigned: boolean } {
  const resolved = resolveSilPayMethod(clientName, stored);
  if (resolved) return { method: resolved, assigned: true };
  return { method: "casual_prorated", assigned: false };
}

export function silPayMethodLabel(method: SilPayMethod): string {
  return LABELS[method];
}

export function silFull313Days(daysWorked: number): number {
  if (daysWorked <= 0) return 0;
  return (daysWorked / SIL_WORKING_DAYS) * 5;
}

export function silFull313Amount(dailyRate: number, daysWorked: number): number {
  if (dailyRate <= 0 || daysWorked <= 0) return 0;
  return (daysWorked / SIL_WORKING_DAYS) * 5 * dailyRate;
}
