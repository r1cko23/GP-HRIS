/**
 * @deprecated Import from `@/lib/ph-payroll` (PH payroll formulas).
 */
export {
  calculateMonthlySalary,
  calculateSSS,
  calculateSssEcc,
  calculatePagIBIG,
  calculatePhilHealth,
  getWithholdingTaxBreakdown,
  calculateSemiMonthlyWithholdingTax,
  calculateWithholdingTax,
  calculateAllContributions,
} from "@/lib/ph-payroll/contributions";
export type {
  WithholdingTaxBreakdown,
  TaxFrequency,
} from "@/lib/ph-payroll/contributions";
