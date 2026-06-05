/**
 * Philippine Payroll Module (Frappe HR / ERPNext-inspired)
 *
 * Public API — import from here only.
 * Phase 1: unified attendance cutoff, semi-monthly tax, deductions loader.
 * Phase 2: payroll entry validation + bulk payslip generation.
 */

export { computeDaysWork } from "./attendance-cutoff";
export {
  getCutoffStatutoryDeductions,
  computeCutoffWithholdingTax,
} from "./statutory-cutoff";
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
} from "./payroll-entry-validation";
export { generatePayslipForEmployee } from "./bulk-payslip";
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
