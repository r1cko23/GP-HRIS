/**
 * Per-cutoff statutory deductions and withholding tax (Philippine semi-monthly payroll).
 *
 * EE amounts are half of monthly (kinsenas). ER / ECC / WISP ER are on the return
 * type for remittance later; they do not enter `total` or net.
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

/** Half of monthly mandatory contributions — applied each cutoff. */
export function getCutoffStatutoryDeductions(
  monthlySalary: number
): CutoffStatutoryDeductions {
  if (monthlySalary <= 0) return emptyCutoffStatutory();

  const sss = calculateSSS(monthlySalary);
  const philhealth = calculatePhilHealth(monthlySalary);
  const pagibig = calculatePagIBIG(monthlySalary);

  const sssRegular = round2((sss.regularEmployeeShare || 0) / 2);
  const sssWisp = round2((sss.wispEmployeeShare || 0) / 2);
  const sssEe = round2((sss.employeeShare || 0) / 2);
  const philhealthHalf = round2((philhealth.employeeShare || 0) / 2);
  const pagibigHalf = round2((pagibig.employeeShare || 0) / 2);

  return {
    sss: sssEe,
    sss_regular: sssRegular,
    sss_wisp: sssWisp,
    philhealth: philhealthHalf,
    pagibig: pagibigHalf,
    total: round2(sssEe + philhealthHalf + pagibigHalf),
    sss_er: round2((sss.employerShare || 0) / 2),
    sss_wisp_er: round2((sss.wispEmployerShare || 0) / 2),
    sss_ecc: round2((sss.ecc || 0) / 2),
    philhealth_er: round2((philhealth.employerShare || 0) / 2),
    pagibig_er: round2((pagibig.employerShare || 0) / 2),
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
