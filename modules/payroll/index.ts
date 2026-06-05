/**
 * Payroll Module - Public API
 *
 * This module handles all payroll-related functionality:
 * - Payslip generation and printing
 * - Salary calculations
 * - Government deductions (SSS, PhilHealth, Pag-IBIG, Tax)
 *
 * Import from this file only - internal implementation may change.
 */

// Components
export { PayslipPrint } from "@/components/PayslipPrint";
export { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";

// Services - Payroll Calculations
export {
  calculateWeeklyPayroll,
  calculateRegularPay,
  calculateRegularOT,
  calculateNightDiff,
  calculateSundayRestDay,
  calculateSundayRestDayOT,
  calculateRegularHoliday,
  calculateRegularHolidayOT,
  calculateNonWorkingHoliday,
  calculateNonWorkingHolidayOT,
  type DayType,
} from "@/utils/payroll-calculator";

// Services - Government Deductions
export {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateWithholdingTax,
  calculateSemiMonthlyWithholdingTax,
  getWithholdingTaxBreakdown,
  calculateMonthlySalary,
} from "@/utils/ph-deductions";
export type { WithholdingTaxBreakdown, TaxFrequency } from "@/utils/ph-deductions";

// Philippine payroll engine (Frappe HR-inspired)
export {
  computeDaysWork,
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
  aggregateCutoffDeductions,
  emptyCutoffDeductions,
  buildPayrollEntryRow,
  summarizePayrollEntry,
  validatePayrollEntry,
  generatePayslipForEmployee,
} from "@/lib/ph-payroll";
export type {
  PayrollEntryStatus,
  PayrollEntryRow,
  PayrollEntrySummary,
  BulkPayslipResult,
} from "@/lib/ph-payroll";

// Utilities
export { formatCurrency, generatePayslipNumber } from "@/utils/format";