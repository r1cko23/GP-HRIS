/**
 * Philippine Payroll Module
 *
 * Public API — import from here only.
 * PH payroll formulas: Statutory (SSS / PhilHealth / Pag-IBIG / WTax) + Premiums (DOLE).
 */

export { computeDaysWork } from "./attendance-cutoff";
export {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
  emptyCutoffStatutory,
} from "./statutory-cutoff";
export { statutoryThisCutoff } from "./statutory-schedule";
export type { StatutoryThisCutoff } from "./statutory-schedule";
export { previewStatutoryFromDailyRate } from "./statutory-preview";
export type { StatutoryPreview } from "./statutory-preview";
export {
  WORKING_DAYS_PER_MONTH,
  roundMoney2,
  roundDailyRate4,
  monthlyFromDailyRate,
  dailyFromMonthlyRate,
  restoreDailyRatePrecision,
  formatDailyRateInput,
} from "./rate-precision";
export {
  calculateMonthlySalary,
  calculateSSS,
  calculateSssEcc,
  calculatePhilHealth,
  calculatePagIBIG,
  getWithholdingTaxBreakdown,
  calculateSemiMonthlyWithholdingTax,
  calculateWithholdingTax,
  calculateAllContributions,
} from "./contributions";
export type { WithholdingTaxBreakdown } from "./contributions";
export {
  PREMIUM_RATES,
  PAYROLL_MULTIPLIERS,
  computeEarningsFromHours,
} from "./premiums";
export type { CutoffHoursRow } from "./premiums";
export {
  aggregateCutoffDeductions,
  emptyCutoffDeductions,
  CUTOFF_FIELD_TO_TYPE,
  MANAGED_DEDUCTION_TYPES,
} from "./deductions-loader";
export { syncCutoffDeductions } from "./deductions-sync";
export {
  buildPayrollEntryRow,
  summarizePayrollEntry,
  validatePayrollEntry,
  payrollEntryRowsToCsv,
} from "./payroll-entry-validation";
export { generatePayslipForEmployee, generatePayslipsForEmployees } from "./bulk-payslip";
export {
  buildLeaveDatesMap,
  applyLeaveOverlayToAttendance,
  getSilCreditedDates,
  sumAttendanceRegularHours,
} from "./leave-overlay";
export type { LeaveDayInfo, LeaveRequestRow } from "./leave-overlay";
export { getRatePerHour, getMonthlySalary } from "./employee-rates";
export {
  computeCutoffPayslipAmounts,
  sumLoansForCutoff,
} from "./compute-cutoff-payslip";
export type {
  PayrollEntryStatus,
  PayrollEntryRow,
  PayrollEntrySummary,
  PayrollEntryEmployeeInput,
  TimesheetWorkflowStatus,
} from "./payroll-entry-validation";
export type { BulkPayslipResult } from "./bulk-payslip";
export type {
  TaxFrequency,
  CutoffDeductions,
  DaysWorkInput,
  DaysWorkResult,
  CutoffStatutoryDeductions,
  CutoffTaxResult,
} from "./types";
