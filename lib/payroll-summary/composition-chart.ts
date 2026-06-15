import type { PayrollSummaryMetrics } from "./types";
import { totalsFromMetrics, type PayrollCategoryTotals } from "./category-breakdown";

export type CompositionView = "gross" | "deductions";

export interface CompositionSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface PeriodComposition {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  total: number;
  slices: CompositionSlice[];
}

/** Distinct palette — readable on light backgrounds, Cost Explorer–style variety. */
export const COMPOSITION_COLORS = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // violet
  "#db2777", // pink
  "#0891b2", // cyan
  "#4f46e5", // indigo
  "#ea580c", // orange
  "#0d9488", // teal
  "#9333ea", // purple
  "#64748b", // slate (Other)
] as const;

const GROSS_SLICE_DEFS: Array<{
  key: keyof PayrollCategoryTotals;
  label: string;
}> = [
  { key: "totalSalary", label: "Regular pay" },
  { key: "regOTAmount", label: "Regular OT pay" },
  { key: "nightDiffAmount", label: "Night differential" },
  { key: "regNightdiffOTAmount", label: "Reg nightdiff OT" },
  { key: "specialHolidayAmount", label: "Special holiday" },
  { key: "totalOTAmount", label: "Total OT pay" },
  { key: "specialHolidayOTAmount", label: "Holiday OT" },
  { key: "restdayAmount", label: "Restday pay" },
  { key: "serviceIncentiveLeaveAmount", label: "SIL pay" },
  { key: "transpoAllowance", label: "Transpo allowance" },
  { key: "loadAllowance", label: "Load allowance" },
  { key: "allowance", label: "Other allowance" },
  { key: "refund", label: "Refunds" },
];

const DEDUCTION_SLICE_DEFS: Array<{
  key: keyof PayrollCategoryTotals;
  label: string;
}> = [
  { key: "sss", label: "SSS" },
  { key: "sssPRO", label: "SSS Provident" },
  { key: "philhealth", label: "PhilHealth" },
  { key: "pagibig", label: "Pag-IBIG" },
  { key: "withholdingTax", label: "Withholding tax" },
  { key: "sssLoan", label: "SSS / salary loan" },
  { key: "otherDeduction", label: "Other deductions" },
];

function periodLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

const SLICE_COLOR_BY_KEY = new Map<string, string>(
  [...GROSS_SLICE_DEFS, ...DEDUCTION_SLICE_DEFS].map((def, i) => [
    def.key,
    COMPOSITION_COLORS[i % COMPOSITION_COLORS.length],
  ])
);

function otPayComponentTotal(totals: PayrollCategoryTotals): number {
  return (
    (totals.regOTAmount ?? 0) +
    (totals.nightDiffAmount ?? 0) +
    (totals.regNightdiffOTAmount ?? 0) +
    (totals.specialHolidayAmount ?? 0) +
    (totals.specialHolidayOTAmount ?? 0) +
    (totals.restdayAmount ?? 0)
  );
}

function buildSlices(
  totals: PayrollCategoryTotals,
  defs: typeof GROSS_SLICE_DEFS,
  totalKey: keyof PayrollCategoryTotals
): CompositionSlice[] {
  const itemizedOT = otPayComponentTotal(totals);

  const raw: CompositionSlice[] = defs
    .map((def) => {
      let value = totals[def.key] ?? 0;
      // Total OT column is a subtotal when itemized OT / holiday pay columns are present.
      if (def.key === "totalOTAmount" && value > 0.01 && itemizedOT > 0.01) {
        if (Math.abs(value - itemizedOT) <= 0.05) {
          value = 0;
        } else {
          value = Math.max(0, value - itemizedOT);
        }
      }
      return {
        key: def.key,
        label: def.label,
        value,
        color: SLICE_COLOR_BY_KEY.get(def.key) ?? COMPOSITION_COLORS[0],
      };
    })
    .filter((s) => s.value > 0.01);

  const reportedTotal = totals[totalKey] ?? 0;
  const sliceSum = raw.reduce((s, x) => s + x.value, 0);
  const remainder = Math.round((reportedTotal - sliceSum) * 100) / 100;

  if (remainder > 0.01) {
    raw.push({
      key: "other",
      label: "Other / unmapped",
      value: remainder,
      color: COMPOSITION_COLORS[COMPOSITION_COLORS.length - 1],
    });
  }

  if (raw.length === 0 && reportedTotal > 0) {
    return [
      {
        key: String(totalKey),
        label: totalKey === "grossAmount" ? "Gross pay" : "Total deductions",
        value: reportedTotal,
        color: COMPOSITION_COLORS[0],
      },
    ];
  }

  // Keep labeled earnings visible; only fold unlabeled crumbs into Other
  const minShare = reportedTotal * 0.02;
  const keepVisibleKeys = new Set([
    "totalSalary",
    "regOTAmount",
    "totalOTAmount",
    "nightDiffAmount",
    "regNightdiffOTAmount",
    "serviceIncentiveLeaveAmount",
    "specialHolidayAmount",
    "allowance",
    "transpoAllowance",
    "loadAllowance",
  ]);
  const major = raw.filter(
    (s) =>
      s.key === "other" ||
      s.value >= minShare ||
      (keepVisibleKeys.has(s.key) && s.value > 0.01)
  );
  const minorSum = raw
    .filter(
      (s) =>
        s.key !== "other" &&
        s.value < minShare &&
        !keepVisibleKeys.has(s.key)
    )
    .reduce((s, x) => s + x.value, 0);

  if (minorSum > 0.01) {
    const other = major.find((s) => s.key === "other");
    if (other) {
      other.value = round2(other.value + minorSum);
    } else {
      major.push({
        key: "other",
        label: "Other",
        value: round2(minorSum),
        color: COMPOSITION_COLORS[COMPOSITION_COLORS.length - 1],
      });
    }
  }

  return major.filter((s) => s.value > 0.01);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildPeriodComposition(
  metrics: PayrollSummaryMetrics,
  view: CompositionView
): PeriodComposition {
  const totals = totalsFromMetrics(metrics);
  const defs = view === "gross" ? GROSS_SLICE_DEFS : DEDUCTION_SLICE_DEFS;
  const totalKey = view === "gross" ? "grossAmount" : "totalDeduction";

  return {
    periodStart: metrics.periodStart,
    periodEnd: metrics.periodEnd,
    periodLabel: periodLabel(metrics.periodStart, metrics.periodEnd),
    total: totals[totalKey],
    slices: buildSlices(totals, defs, totalKey),
  };
}

export function buildCompositionSeries(
  uploads: PayrollSummaryMetrics[],
  view: CompositionView
): PeriodComposition[] {
  return uploads
    .filter((u) => u.periodStart)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((u) => buildPeriodComposition(u, view));
}

/** Union of slice keys across periods for a stable legend order. */
export function compositionLegend(
  series: PeriodComposition[]
): CompositionSlice[] {
  const order = [...GROSS_SLICE_DEFS, ...DEDUCTION_SLICE_DEFS].map((d) => d.key);
  const byKey = new Map<string, CompositionSlice>();

  for (const period of series) {
    for (const slice of period.slices) {
      if (!byKey.has(slice.key)) {
        byKey.set(slice.key, { ...slice, value: 0 });
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const ai = order.indexOf(a.key as (typeof order)[number]);
    const bi = order.indexOf(b.key as (typeof order)[number]);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** True when bars have meaningful slice breakdown (not a single block). */
export function hasRichComposition(series: PeriodComposition[]): boolean {
  return series.some((p) => p.slices.filter((s) => s.key !== "other").length >= 2);
}
