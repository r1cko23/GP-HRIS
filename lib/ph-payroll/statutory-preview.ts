/**
 * Estimate statutory amounts from Directory daily rate (201 file preview).
 * Uses the same helpers as Organic register build (×26 monthly, ÷2 per kinsena).
 *
 * Daily rate may be stored at up to 4dp; UI formats money at 2dp. Monthly basis
 * multiplies the full-precision daily, then rounds to centavos.
 */

import { calculateMonthlySalary } from "./contributions";
import {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "./statutory-cutoff";
import {
  WORKING_DAYS_PER_MONTH,
  roundMoney2,
} from "./rate-precision";

const round2 = roundMoney2;

export type StatutoryPreview = {
  dailyRate: number;
  monthlySalary: number;
  hourlyRate: number;
  /** EE shares per kinsena (half of monthly tables). */
  perCutoff: {
    sss: number;
    philhealth: number;
    pagibig: number;
    total: number;
  };
  /** EE shares per month (2 × per-cutoff when both kinsenas deduct). */
  monthlyEe: {
    sss: number;
    philhealth: number;
    pagibig: number;
    total: number;
  };
  /** Employer remittance (monthly; ECC is employer-only). */
  monthlyEr: {
    sss: number;
    sss_wisp: number;
    sss_ecc: number;
    philhealth: number;
    pagibig: number;
  };
  /** Illustrative WTAX on basic-only semi-monthly gross (not actual cutoff earnings). */
  wtaxIllustrative: {
    referenceGross: number;
    taxableIncome: number;
    withholdingTax: number;
  };
};

export function previewStatutoryFromDailyRate(
  dailyRateInput: number | string | null | undefined,
  workingDaysPerMonth = WORKING_DAYS_PER_MONTH
): StatutoryPreview | null {
  const dailyRate = Number(dailyRateInput ?? 0);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) return null;

  const monthlySalary = calculateMonthlySalary(dailyRate, workingDaysPerMonth);
  const cutoff = getCutoffStatutoryDeductions(monthlySalary);

  const perCutoff = {
    sss: cutoff.sss,
    philhealth: cutoff.philhealth,
    pagibig: cutoff.pagibig,
    total: cutoff.total,
  };

  const monthlyEe = {
    sss: round2(cutoff.sss * 2),
    philhealth: round2(cutoff.philhealth * 2),
    pagibig: round2(cutoff.pagibig * 2),
    total: round2(cutoff.total * 2),
  };

  const monthlyEr = {
    sss: round2(cutoff.sss_er * 2),
    sss_wisp: round2(cutoff.sss_wisp_er * 2),
    sss_ecc: round2(cutoff.sss_ecc * 2),
    philhealth: round2(cutoff.philhealth_er * 2),
    pagibig: round2(cutoff.pagibig_er * 2),
  };

  const referenceGross = round2(monthlySalary / 2);
  const wtax = computeCutoffWithholdingTax(
    referenceGross,
    monthlySalary,
    undefined,
    cutoff.total
  );

  return {
    dailyRate,
    monthlySalary: round2(monthlySalary),
    hourlyRate: round2(dailyRate / 8),
    perCutoff,
    monthlyEe,
    monthlyEr,
    wtaxIllustrative: {
      referenceGross,
      taxableIncome: wtax.taxableIncome,
      withholdingTax: wtax.tax,
    },
  };
}
