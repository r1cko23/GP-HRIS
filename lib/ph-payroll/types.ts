/**
 * Philippine payroll types (Frappe HR Salary Structure pattern).
 * Single source of truth for cutoff attendance and deduction shapes.
 */

export type TaxFrequency = "daily" | "weekly" | "semi-monthly" | "monthly";

/** Aggregated deductions for one bi-monthly cutoff (wide format for payslip UI). */
export interface CutoffDeductions {
  vale_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
  other_deduction: number;
  sss_pro: number;
}

export interface DaysWorkInput {
  basePayHours: number;
  actualTotalBH: number;
  renderedSpecialBH: number;
  /** Supervisory/managerial/client-based: exclude rendered special-day hours from regular Days Work. */
  excludeWorkedSpecialDayFromDaysWork: boolean;
}

export interface DaysWorkResult {
  totalBHForDaysWork: number;
  daysWorked: number;
}

export interface CutoffStatutoryDeductions {
  sss: number;
  philhealth: number;
  pagibig: number;
  total: number;
}

export interface CutoffTaxResult {
  tax: number;
  taxableIncome: number;
  cutoffContributions: number;
}
