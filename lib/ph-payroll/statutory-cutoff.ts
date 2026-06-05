/**
 * Per-cutoff statutory deductions and withholding tax (Philippine semi-monthly payroll).
 *
 * BIR Revised Withholding Tax Table — effective January 1, 2023 and onwards (still valid 2026).
 * Statutory: 50% of monthly SSS / PhilHealth / Pag-IBIG per cutoff (standard kinsenas practice).
 */

import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  getWithholdingTaxBreakdown,
} from "@/utils/ph-deductions";
import type { CutoffStatutoryDeductions, CutoffTaxResult } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Half of monthly mandatory contributions — applied each cutoff. */
export function getCutoffStatutoryDeductions(
  monthlySalary: number
): CutoffStatutoryDeductions {
  if (monthlySalary <= 0) {
    return { sss: 0, philhealth: 0, pagibig: 0, total: 0 };
  }

  const sss = calculateSSS(monthlySalary);
  const philhealth = calculatePhilHealth(monthlySalary);
  const pagibig = calculatePagIBIG(monthlySalary);

  const sssHalf = round2((sss.employeeShare || 0) / 2);
  const philhealthHalf = round2((philhealth.employeeShare || 0) / 2);
  const pagibigHalf = round2((pagibig.employeeShare || 0) / 2);

  return {
    sss: sssHalf,
    philhealth: philhealthHalf,
    pagibig: pagibigHalf,
    total: round2(sssHalf + philhealthHalf + pagibigHalf),
  };
}

/**
 * Withholding tax for one cutoff using BIR semi-monthly table.
 * Taxable income = period gross − this cutoff's share of mandatory contributions.
 */
export function computeCutoffWithholdingTax(
  periodGross: number,
  monthlySalary: number,
  manualTax?: number
): CutoffTaxResult {
  if (manualTax != null && manualTax > 0) {
    return {
      tax: round2(manualTax),
      taxableIncome: periodGross,
      cutoffContributions: 0,
    };
  }

  const statutory = getCutoffStatutoryDeductions(monthlySalary);
  const taxableIncome = Math.max(0, round2(periodGross - statutory.total));
  const breakdown = getWithholdingTaxBreakdown(taxableIncome, "semi-monthly");

  return {
    tax: breakdown.withholdingTax,
    taxableIncome,
    cutoffContributions: statutory.total,
  };
}
