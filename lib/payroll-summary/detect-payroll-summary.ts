/**
 * Detect payroll summary register files by filename (upload training set pattern).
 * Files in samples/payroll-registers use names like:
 *   PAYROLL SUMMARY_CHICHA HUT.pdf
 *   Payroll Summary_VIVENTIS.pdf
 *   Payrollsummary_LAGUNA.pdf
 */

const PAYROLL_SUMMARY_NAME =
  /^(?:payroll\s*summary|payrollsummary)(?:\s|_)/i;

const NON_SUMMARY_PATTERNS = [
  /^atm\s/i,
  /^cash\s/i,
  /payslip/i,
  /report/i,
  /^payroll\s*report/i,
];

export function isPayrollSummaryFileName(fileName: string): boolean {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  if (!PAYROLL_SUMMARY_NAME.test(base)) return false;
  if (NON_SUMMARY_PATTERNS.some((re) => re.test(base))) return false;
  return true;
}

export function assertPayrollSummaryFileName(fileName: string): void {
  if (!isPayrollSummaryFileName(fileName)) {
    throw new Error(
      `Upload a Payroll Summary PDF for comparison (filename should start with "Payroll Summary" or "PAYROLL SUMMARY"). Got: ${fileName}`
    );
  }
}
