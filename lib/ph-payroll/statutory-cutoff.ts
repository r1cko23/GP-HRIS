/**
 * Per-cutoff statutory deductions and withholding tax (Philippine semi-monthly payroll).
 *
 * EE amounts are half of monthly by default (kinsenas). When `amountMode` is
 * `full` (Monthly schedule collect window, or Pag-IBIG on first Deployed
 * kinsena), EE/ER are the full monthly shares. ER / ECC / WISP ER are on the
 * return type for remittance later; they do not enter `total` or net.
 */

import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  getWithholdingTaxBreakdown,
} from "./contributions";
import type { CutoffStatutoryDeductions, CutoffTaxResult } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function emptyCutoffStatutory(): CutoffStatutoryDeductions {
  return {
    sss: 0,
    sss_regular: 0,
    sss_wisp: 0,
    philhealth: 0,
    pagibig: 0,
    total: 0,
    sss_er: 0,
    sss_wisp_er: 0,
    sss_ecc: 0,
    philhealth_er: 0,
    pagibig_er: 0,
  };
}

export type StatutorySplitMode = "half" | "full";

function splitAmount(monthly: number, mode: StatutorySplitMode): number {
  const value = Number(monthly) || 0;
  if (mode === "full") return round2(value);
  return round2(value / 2);
}

/** Mandatory contributions for one cutoff — half or full monthly EE/ER. */
export function getCutoffStatutoryDeductions(
  monthlySalary: number,
  amountMode: StatutorySplitMode = "half"
): CutoffStatutoryDeductions {
  if (monthlySalary <= 0) return emptyCutoffStatutory();

  const sss = calculateSSS(monthlySalary);
  const philhealth = calculatePhilHealth(monthlySalary);
  const pagibig = calculatePagIBIG(monthlySalary);

  const sssRegular = splitAmount(sss.regularEmployeeShare || 0, amountMode);
  const sssWisp = splitAmount(sss.wispEmployeeShare || 0, amountMode);
  const sssEe = splitAmount(sss.employeeShare || 0, amountMode);
  const philhealthEe = splitAmount(philhealth.employeeShare || 0, amountMode);
  const pagibigEe = splitAmount(pagibig.employeeShare || 0, amountMode);

  return {
    sss: sssEe,
    sss_regular: sssRegular,
    sss_wisp: sssWisp,
    philhealth: philhealthEe,
    pagibig: pagibigEe,
    total: round2(sssEe + philhealthEe + pagibigEe),
    sss_er: splitAmount(sss.employerShare || 0, amountMode),
    sss_wisp_er: splitAmount(sss.wispEmployerShare || 0, amountMode),
    sss_ecc: splitAmount(sss.ecc || 0, amountMode),
    philhealth_er: splitAmount(philhealth.employerShare || 0, amountMode),
    pagibig_er: splitAmount(pagibig.employerShare || 0, amountMode),
  };
}

/**
 * Withholding tax for one cutoff using BIR semi-monthly table.
 * Taxable income = period gross − this cutoff's share of mandatory EE contributions.
 */
export function computeCutoffWithholdingTax(
  periodGross: number,
  monthlySalary: number,
  manualTax?: number,
  /** EE statutory actually withheld this cutoff (0 on Organic first kinsena). */
  cutoffContributionsOverride?: number
): CutoffTaxResult {
  if (manualTax != null && manualTax > 0) {
    return {
      tax: round2(manualTax),
      taxableIncome: periodGross,
      cutoffContributions: 0,
    };
  }

  const cutoffContributions =
    cutoffContributionsOverride != null
      ? round2(Math.max(0, cutoffContributionsOverride))
      : getCutoffStatutoryDeductions(monthlySalary).total;
  const taxableIncome = Math.max(0, round2(periodGross - cutoffContributions));
  const breakdown = getWithholdingTaxBreakdown(taxableIncome, "semi-monthly");

  return {
    tax: breakdown.withholdingTax,
    taxableIncome,
    cutoffContributions,
  };
}
