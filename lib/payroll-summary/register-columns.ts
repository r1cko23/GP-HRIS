/**
 * Canonical payroll register columns — matches app/reports/page.tsx export layout.
 *
 * Numeric columns appear after the employee name in PDF/CSV rows.
 * The GP-HRIS TOTAL row leaves daily rate blank (33 numeric fields).
 */

export interface PayrollRegisterRow {
  name: string;
  dailyRate: number;
  hoursWorked: number;
  daysWorked: number;
  basicSalary: number;
  totalSalary: number;
  regOTHours: number;
  regOTAmount: number;
  nightDiffHours: number;
  nightDiffAmount: number;
  specialHolidayHours: number;
  specialHolidayAmount: number;
  specialHolidayOTHours: number;
  specialHolidayOTAmount: number;
  restdayHours: number;
  restdayAmount: number;
  totalOTAmount: number;
  serviceIncentiveLeaveAmount: number;
  refund: number;
  transpoAllowance: number;
  loadAllowance: number;
  allowance: number;
  grossAmount: number;
  sss: number;
  sssPRO: number;
  philhealth: number;
  pagibig: number;
  withholdingTax: number;
  sssLoan: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  thirteenthMonthCutoff: number;
  silCutoff: number;
  thirteenthMonthYTD: number;
}

/** CSV / PDF headers from the payroll register report export. */
export const PAYROLL_REGISTER_HEADERS = [
  "Employee Name",
  "Daily Rate",
  "Hours Worked",
  "Days Worked",
  "Basic Salary",
  "Total Salary",
  "Reg OT Hours",
  "Reg OT Amount",
  "Night Diff Hours",
  "Night Diff Amount",
  "Special Holiday Hours",
  "Special Holiday Amount",
  "Special Holiday OT Hours",
  "Special Holiday OT Amount",
  "Restday Hours",
  "Restday Amount",
  "Total OT Amount",
  "Service Incentive Leave Amount",
  "Refund",
  "Transpo Allowance",
  "Load Allowance",
  "Allowance",
  "Gross Amount",
  "SSS",
  "SSS PRO",
  "Philhealth",
  "Pagibig",
  "Withholding Tax",
  "SSS LOAN",
  "Other Deduction",
  "Total Deduction",
  "NET Amount",
  "13th Month Cutoff",
  "SIL Cutoff",
  "13th Month YTD",
] as const;

/** Field index map for a full employee row (daily rate included). */
export const GP_HRIS_REGISTER_COL = {
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  nightDiffHours: 7,
  nightDiffAmount: 8,
  specialHolidayHours: 9,
  specialHolidayAmount: 10,
  specialHolidayOTHours: 11,
  specialHolidayOTAmount: 12,
  restdayHours: 13,
  restdayAmount: 14,
  totalOTAmount: 15,
  serviceIncentiveLeaveAmount: 16,
  refund: 17,
  transpoAllowance: 18,
  loadAllowance: 19,
  allowance: 20,
  grossAmount: 21,
  sss: 22,
  sssPRO: 23,
  philhealth: 24,
  pagibig: 25,
  withholdingTax: 26,
  sssLoan: 27,
  otherDeduction: 28,
  totalDeduction: 29,
  netAmount: 30,
  thirteenthMonthCutoff: 31,
  silCutoff: 32,
  thirteenthMonthYTD: 33,
} as const;

export const GP_HRIS_REGISTER_MIN_COLUMNS = 34;
export const GP_HRIS_TOTAL_MIN_COLUMNS = 33;

type RegisterFieldKey = keyof Omit<PayrollRegisterRow, "name">;

export type RegisterLayoutMap = Partial<Record<RegisterFieldKey, number>> & {
  minColumns: number;
};

/** GP-HRIS TOTAL row — daily rate column is blank in the export. */
export const GP_HRIS_TOTAL_LAYOUT: RegisterLayoutMap = {
  minColumns: GP_HRIS_TOTAL_MIN_COLUMNS,
  hoursWorked: 0,
  daysWorked: 1,
  basicSalary: 2,
  totalSalary: 3,
  regOTHours: 4,
  regOTAmount: 5,
  nightDiffHours: 6,
  nightDiffAmount: 7,
  specialHolidayHours: 8,
  specialHolidayAmount: 9,
  specialHolidayOTHours: 10,
  specialHolidayOTAmount: 11,
  restdayHours: 12,
  restdayAmount: 13,
  totalOTAmount: 14,
  serviceIncentiveLeaveAmount: 15,
  refund: 16,
  transpoAllowance: 17,
  loadAllowance: 18,
  allowance: 19,
  grossAmount: 20,
  sss: 21,
  sssPRO: 22,
  philhealth: 23,
  pagibig: 24,
  withholdingTax: 25,
  sssLoan: 26,
  otherDeduction: 27,
  totalDeduction: 28,
  netAmount: 29,
  thirteenthMonthCutoff: 30,
  silCutoff: 31,
  thirteenthMonthYTD: 32,
};

/** Full GP-HRIS employee row (same fields, daily rate at index 0). */
export const GP_HRIS_EMPLOYEE_LAYOUT: RegisterLayoutMap = {
  minColumns: GP_HRIS_REGISTER_MIN_COLUMNS,
  ...GP_HRIS_REGISTER_COL,
};

/**
 * Wide external earnings block (Converge-style) through Gross Amt.
 * Maps into the canonical register fields where they align.
 */
export const EXTERNAL_EARNINGS_28_LAYOUT: RegisterLayoutMap = {
  minColumns: 28,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  nightDiffHours: 7,
  nightDiffAmount: 8,
  totalOTAmount: 23,
  allowance: 26,
  grossAmount: 27,
};

/**
 * Converge PDFs vary the tail columns between cutoffs:
 * - May 1–15 style: allowance @26, gross @27
 * - May 16–31 style: allowance @25, gross @26 (total row may add SSS @27)
 */
export function resolveConverge28TailLayout(
  nums: number[],
  isTotalRow = false
): Pick<RegisterLayoutMap, "allowance" | "grossAmount" | "sss"> {
  if (nums.length < 28) {
    return { allowance: 26, grossAmount: 27 };
  }

  const n26 = nums[26] ?? 0;
  const n27 = nums[27] ?? 0;

  // Total row: gross @26 with company SSS total @27 (May 16–31 Converge style)
  if (
    isTotalRow &&
    n26 > 100_000 &&
    n27 > 1000 &&
    n27 < 500_000 &&
    n27 < n26
  ) {
    return { allowance: 25, grossAmount: 26, sss: 27 };
  }

  // Gross @27 (May 1–15 employee and total style)
  if (n27 > n26 && n27 > 1000) {
    return { allowance: 26, grossAmount: 27 };
  }

  // Gross @26, no per-row SSS (May 16–31 employee style)
  if (n26 > 1000 && n27 <= 1000) {
    return { allowance: 25, grossAmount: 26 };
  }

  return { allowance: 26, grossAmount: 27 };
}

export function mergeConverge28Layout(
  nums: number[],
  isTotalRow = false
): RegisterLayoutMap {
  return {
    ...EXTERNAL_EARNINGS_28_LAYOUT,
    ...resolveConverge28TailLayout(nums, isTotalRow),
  };
}

/** Compact external register (Chicha Hut 24-column). */
export const EXTERNAL_CHICHA_24_LAYOUT: RegisterLayoutMap = {
  minColumns: 23,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  regOTHours: 5,
  totalOTAmount: 13,
  grossAmount: 14,
  netAmount: 20,
  silCutoff: 22,
};

/** Compact external register (Chicha Hut 21-column) — employee rows. */
export const EXTERNAL_CHICHA_21_LAYOUT: RegisterLayoutMap = {
  minColumns: 21,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  regOTHours: 5,
  totalOTAmount: 13,
  grossAmount: 17,
  netAmount: 20,
  silCutoff: 19,
};

/** Chicha Hut 21-column totals row — gross is at index 3. */
export const EXTERNAL_CHICHA_21_TOTAL_LAYOUT: RegisterLayoutMap = {
  minColumns: 21,
  hoursWorked: 1,
  daysWorked: 2,
  regOTHours: 5,
  totalOTAmount: 13,
  grossAmount: 3,
  netAmount: 20,
  silCutoff: 19,
};

export function emptyRegisterRow(name: string): PayrollRegisterRow {
  return {
    name,
    dailyRate: 0,
    hoursWorked: 0,
    daysWorked: 0,
    basicSalary: 0,
    totalSalary: 0,
    regOTHours: 0,
    regOTAmount: 0,
    nightDiffHours: 0,
    nightDiffAmount: 0,
    specialHolidayHours: 0,
    specialHolidayAmount: 0,
    specialHolidayOTHours: 0,
    specialHolidayOTAmount: 0,
    restdayHours: 0,
    restdayAmount: 0,
    totalOTAmount: 0,
    serviceIncentiveLeaveAmount: 0,
    refund: 0,
    transpoAllowance: 0,
    loadAllowance: 0,
    allowance: 0,
    grossAmount: 0,
    sss: 0,
    sssPRO: 0,
    philhealth: 0,
    pagibig: 0,
    withholdingTax: 0,
    sssLoan: 0,
    otherDeduction: 0,
    totalDeduction: 0,
    netAmount: 0,
    thirteenthMonthCutoff: 0,
    silCutoff: 0,
    thirteenthMonthYTD: 0,
  };
}

export function parseRegisterRow(
  name: string,
  nums: number[],
  layout: RegisterLayoutMap
): PayrollRegisterRow | null {
  if (nums.length < layout.minColumns) return null;

  const row = emptyRegisterRow(name);
  for (const [field, index] of Object.entries(layout)) {
    if (field === "minColumns" || index == null) continue;
    row[field as RegisterFieldKey] = nums[index as number] ?? 0;
  }
  return row;
}

export function resolveExternalRegisterLayout(
  tokenCount: number,
  text?: string,
  nums?: number[],
  options?: { isTotalRow?: boolean }
): RegisterLayoutMap | null {
  if (tokenCount >= EXTERNAL_EARNINGS_28_LAYOUT.minColumns) {
    if (nums && options?.isTotalRow) {
      return mergeConverge28Layout(nums, true);
    }
    return EXTERNAL_EARNINGS_28_LAYOUT;
  }
  if (tokenCount >= EXTERNAL_CHICHA_24_LAYOUT.minColumns) {
    return EXTERNAL_CHICHA_24_LAYOUT;
  }
  if (tokenCount >= EXTERNAL_CHICHA_21_LAYOUT.minColumns) {
    return options?.isTotalRow
      ? EXTERNAL_CHICHA_21_TOTAL_LAYOUT
      : EXTERNAL_CHICHA_21_LAYOUT;
  }
  return null;
}

export function resolveGpHrisLayout(tokenCount: number): RegisterLayoutMap | null {
  if (tokenCount >= GP_HRIS_EMPLOYEE_LAYOUT.minColumns) {
    return GP_HRIS_EMPLOYEE_LAYOUT;
  }
  if (tokenCount >= GP_HRIS_TOTAL_LAYOUT.minColumns) {
    return GP_HRIS_TOTAL_LAYOUT;
  }
  return null;
}

export function pickRegisterTotals(row: PayrollRegisterRow) {
  return {
    hoursWorkedTotal: row.hoursWorked,
    regOTHoursTotal: row.regOTHours,
    grossAmountTotal: row.grossAmount,
    netAmountTotal: row.netAmount,
    silCutoffTotal: row.silCutoff,
    silTotal: row.serviceIncentiveLeaveAmount,
    totalOTAmount: row.totalOTAmount,
  };
}
