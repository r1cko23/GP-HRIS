/**
 * Load cutoff deductions from row-based employee_deductions table.
 * Maps deduction_type rows → wide payslip format (Frappe Salary Component pattern).
 */

import type { CutoffDeductions } from "./types";

type DeductionRow = {
  deduction_type: string;
  amount: number | string;
  deduction_date?: string | null;
};

/** Canonical deduction_type written to employee_deductions rows. */
export const CUTOFF_FIELD_TO_TYPE: Record<keyof CutoffDeductions, string> = {
  vale_amount: "vale",
  sss_salary_loan: "sss_salary_loan",
  sss_calamity_loan: "sss_calamity_loan",
  pagibig_salary_loan: "pagibig_salary_loan",
  pagibig_calamity_loan: "pagibig_calamity_loan",
  sss_contribution: "sss_contribution",
  philhealth_contribution: "philhealth_contribution",
  pagibig_contribution: "pagibig_contribution",
  withholding_tax: "withholding_tax",
  other_deduction: "other_deduction",
  sss_pro: "sss_pro",
};

/** Legacy deduction_type aliases still read from existing rows. */
export const LEGACY_DEDUCTION_TYPES = [
  "Vale",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "Tax",
  "Loan",
] as const;

export const MANAGED_DEDUCTION_TYPES = [
  ...Object.values(CUTOFF_FIELD_TO_TYPE),
  ...LEGACY_DEDUCTION_TYPES,
];

const TYPE_MAP: Record<string, keyof CutoffDeductions> = {
  vale: "vale_amount",
  Vale: "vale_amount",
  sss_salary_loan: "sss_salary_loan",
  sss_calamity_loan: "sss_calamity_loan",
  pagibig_salary_loan: "pagibig_salary_loan",
  pagibig_calamity_loan: "pagibig_calamity_loan",
  sss_contribution: "sss_contribution",
  SSS: "sss_contribution",
  philhealth_contribution: "philhealth_contribution",
  PhilHealth: "philhealth_contribution",
  pagibig_contribution: "pagibig_contribution",
  "Pag-IBIG": "pagibig_contribution",
  withholding_tax: "withholding_tax",
  Tax: "withholding_tax",
  other_deduction: "other_deduction",
  Loan: "sss_salary_loan",
  sss_pro: "sss_pro",
};

export function emptyCutoffDeductions(): CutoffDeductions {
  return {
    vale_amount: 0,
    sss_salary_loan: 0,
    sss_calamity_loan: 0,
    pagibig_salary_loan: 0,
    pagibig_calamity_loan: 0,
    sss_contribution: 0,
    philhealth_contribution: 0,
    pagibig_contribution: 0,
    withholding_tax: 0,
    other_deduction: 0,
    sss_pro: 0,
  };
}

/**
 * Aggregate row-based deductions for an employee within a cutoff period.
 */
export function aggregateCutoffDeductions(rows: DeductionRow[]): CutoffDeductions {
  const result = emptyCutoffDeductions();

  for (const row of rows) {
    const field = TYPE_MAP[row.deduction_type];
    if (!field) continue;
    const amount = parseFloat(String(row.amount)) || 0;
    result[field] = Math.round((result[field] + amount) * 100) / 100;
  }

  return result;
}
