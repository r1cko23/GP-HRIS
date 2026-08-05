import {
  detectExternalRegisterLayout,
  inferRegisterColumnCount,
} from "./detect-register-layout";

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
  /** Reg nightdiff OT — separate from plain NightDiff on wide Chicha-style registers. */
  regNightdiffOTHours: number;
  regNightdiffOTAmount: number;
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
  totalOTAmount: 23,
  allowance: 26,
  grossAmount: 27,
};

/**
 * GP-HRIS internal payroll register (multi-page, Salaries and Wages footer).
 * Gross column index varies slightly by cutoff (21 vs 22); resolved from footer on totals row.
 */
export function resolveGpInternal28Layout(
  text: string,
  nums: number[],
  isTotalRow: boolean
): RegisterLayoutMap {
  let grossAmount = 22;

  const footerMatch = text.match(/Salaries and Wages:\s*([\d,]+\.?\d*)/i);
  if (footerMatch && isTotalRow && nums.length === 28) {
    const footerGross = Number(footerMatch[1].replace(/,/g, ""));
    const idx = nums.findIndex((n) => Math.abs(n - footerGross) < 2);
    if (idx >= 0) grossAmount = idx;
  }

  return {
    minColumns: 28,
    dailyRate: 0,
    hoursWorked: 1,
    daysWorked: 2,
    basicSalary: 3,
    totalSalary: 4,
    regOTHours: 5,
    regOTAmount: 6,
    restdayHours: 14,
    restdayAmount: 15,
    totalOTAmount: 16,
    serviceIncentiveLeaveAmount: 18,
    transpoAllowance: 19,
    loadAllowance: 20,
    allowance: Math.max(0, grossAmount - 1),
    grossAmount,
    sss: grossAmount + 1,
    philhealth: grossAmount + 3,
    pagibig: grossAmount + 4,
    withholdingTax: grossAmount + 5,
  };
}

/** @deprecated Use resolveGpInternal28Layout — kept for tests referencing static map */
export const EXTERNAL_GP_INTERNAL_28_LAYOUT: RegisterLayoutMap =
  resolveGpInternal28Layout("", [], false);

function isGpInternalPayrollRegister(
  text?: string,
  nums?: number[],
  isTotalRow?: boolean
): boolean {
  if (!text || !/Salaries and Wages:/i.test(text)) return false;
  if (!/\bDaily Rate\b/i.test(text)) return false;

  const footerMatch = text.match(/Salaries and Wages:\s*([\d,]+\.?\d*)/i);
  if (footerMatch && nums && nums.length === 28 && isTotalRow) {
    const footerGross = Number(footerMatch[1].replace(/,/g, ""));
    const colGross = nums[22] ?? 0;
    if (footerGross > 10_000 && Math.abs(colGross - footerGross) < 2) {
      return true;
    }
  }

  if (!/Transpo\s*\n?\s*Allowance/i.test(text)) return false;
  if (!/Withholding\s*Tax/i.test(text)) return false;

  return (
    /Income\s+Adjustment/i.test(text) ||
    (/Service\s*\n?\s*Incentive/i.test(text) &&
      /Out of Town\s*\n?\s*Salary/i.test(text))
  );
}

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

/** Chicha Hut full register — 24 columns (reg OT + night diff + legal holiday). */
export const EXTERNAL_CHICHA_24_LAYOUT: RegisterLayoutMap = {
  minColumns: 24,
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
  regNightdiffOTHours: 11,
  regNightdiffOTAmount: 12,
  totalOTAmount: 13,
  grossAmount: 14,
  sss: 15,
  philhealth: 16,
  pagibig: 17,
  otherDeduction: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
  thirteenthMonthYTD: 23,
};

/** Compact Chicha Hut — 21 columns (reg OT + legal holiday; no night diff). */
export const EXTERNAL_CHICHA_21_LAYOUT: RegisterLayoutMap = {
  minColumns: 21,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  specialHolidayHours: 7,
  specialHolidayAmount: 8,
  totalOTAmount: 9,
  grossAmount: 10,
  sss: 11,
  philhealth: 12,
  sssLoan: 13,
  otherDeduction: 15,
  totalDeduction: 16,
  netAmount: 17,
  thirteenthMonthCutoff: 18,
  silCutoff: 19,
  thirteenthMonthYTD: 20,
};

/** Nabati EDD — 19 columns (meal / comm / gas allowances, no pag-ibig column). */
export const EXTERNAL_NABATI_EDD_19_LAYOUT: RegisterLayoutMap = {
  minColumns: 19,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  totalOTAmount: 5,
  serviceIncentiveLeaveAmount: 6,
  transpoAllowance: 7,
  loadAllowance: 8,
  allowance: 9,
  grossAmount: 10,
  sss: 11,
  philhealth: 12,
  pagibig: 13,
  totalDeduction: 14,
  netAmount: 15,
  thirteenthMonthCutoff: 16,
  silCutoff: 17,
  thirteenthMonthYTD: 18,
};

/** Nabati EDD — 21 columns (legal holiday + meal / comm / gas). */
export const EXTERNAL_NABATI_EDD_21_LAYOUT: RegisterLayoutMap = {
  minColumns: 21,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  specialHolidayHours: 5,
  specialHolidayAmount: 6,
  totalOTAmount: 7,
  serviceIncentiveLeaveAmount: 8,
  transpoAllowance: 9,
  loadAllowance: 10,
  allowance: 11,
  grossAmount: 12,
  sss: 13,
  philhealth: 14,
  pagibig: 15,
  totalDeduction: 16,
  netAmount: 17,
  thirteenthMonthCutoff: 18,
  silCutoff: 19,
  thirteenthMonthYTD: 20,
};

/** Nabati EDD — 22 columns (reg OT + reg nightdiff + meal / comm). */
export const EXTERNAL_NABATI_EDD_22_LAYOUT: RegisterLayoutMap = {
  minColumns: 22,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 9,
  transpoAllowance: 11,
  loadAllowance: 12,
  grossAmount: 13,
  sss: 14,
  philhealth: 15,
  pagibig: 16,
  totalDeduction: 17,
  netAmount: 18,
  thirteenthMonthCutoff: 19,
  silCutoff: 20,
  thirteenthMonthYTD: 21,
};

/** Nabati EDD — 24 columns (reg nightdiff OT block before gross). */
export const EXTERNAL_NABATI_EDD_24_LAYOUT: RegisterLayoutMap = {
  minColumns: 24,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 7,
  nightDiffAmount: 6,
  totalOTAmount: 9,
  grossAmount: 14,
  sss: 15,
  philhealth: 16,
  pagibig: 17,
  withholdingTax: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
  thirteenthMonthYTD: 23,
};

/** COMCLARK — 23 columns (special holiday + restday OT). */
export const EXTERNAL_COMCLARK_23_LAYOUT: RegisterLayoutMap = {
  minColumns: 23,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  specialHolidayHours: 7,
  specialHolidayAmount: 8,
  restdayHours: 9,
  restdayAmount: 10,
  totalOTAmount: 11,
  allowance: 14,
  grossAmount: 13,
  sss: 14,
  sssPRO: 15,
  philhealth: 16,
  pagibig: 17,
  withholdingTax: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
};

/** Vouno — 23 columns (restday OT + working dayoff; no 24-col income adjustment). */
export const EXTERNAL_VOUNO_23_LAYOUT: RegisterLayoutMap = {
  minColumns: 23,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  totalOTAmount: 6,
  grossAmount: 12,
  sss: 13,
  philhealth: 14,
  pagibig: 15,
  withholdingTax: 16,
  otherDeduction: 17,
  totalDeduction: 18,
  netAmount: 19,
  thirteenthMonthCutoff: 20,
  silCutoff: 21,
  thirteenthMonthYTD: 22,
};

/** Goldilocks — 25 columns (SH restday OT + meal / gas allowances). */
export const EXTERNAL_GOLDILOCKS_25_LAYOUT: RegisterLayoutMap = {
  minColumns: 25,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  specialHolidayOTHours: 7,
  specialHolidayOTAmount: 8,
  totalOTAmount: 9,
  refund: 10,
  loadAllowance: 11,
  transpoAllowance: 12,
  allowance: 13,
  grossAmount: 14,
  sss: 15,
  philhealth: 16,
  pagibig: 17,
  withholdingTax: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
  thirteenthMonthYTD: 23,
};

/** KRR / La Chicks compact — 19 columns (reg OT, no night diff). */
export const EXTERNAL_KRR_19_LAYOUT: RegisterLayoutMap = {
  minColumns: 19,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 7,
  grossAmount: 8,
  sss: 9,
  philhealth: 10,
  pagibig: 11,
  withholdingTax: 12,
  totalDeduction: 14,
  netAmount: 15,
  thirteenthMonthCutoff: 16,
  silCutoff: 17,
};

/** Vouno compact — 20 columns (income adjustment, no restday OT block). */
export const EXTERNAL_VOUNO_20_LAYOUT: RegisterLayoutMap = {
  minColumns: 20,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 7,
  grossAmount: 8,
  sss: 9,
  philhealth: 10,
  otherDeduction: 11,
  withholdingTax: 13,
  totalDeduction: 15,
  netAmount: 16,
  thirteenthMonthCutoff: 17,
  silCutoff: 18,
};

/** Popeyes / PLK compact — 12 columns. */
export const EXTERNAL_COMPACT_12_LAYOUT: RegisterLayoutMap = {
  minColumns: 12,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 7,
  grossAmount: 8,
  netAmount: 9,
  thirteenthMonthCutoff: 10,
  silCutoff: 11,
};

/** Driver / micro payroll — 13 columns (Milay-style). */
export const EXTERNAL_COMPACT_13_LAYOUT: RegisterLayoutMap = {
  minColumns: 13,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  grossAmount: 5,
  sss: 6,
  philhealth: 7,
  pagibig: 8,
  totalDeduction: 9,
  netAmount: 10,
  thirteenthMonthCutoff: 11,
  silCutoff: 12,
};

/** Novo Pets / small retail — 16 columns. */
export const EXTERNAL_COMPACT_16_LAYOUT: RegisterLayoutMap = {
  minColumns: 16,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  allowance: 5,
  regOTAmount: 6,
  grossAmount: 7,
  sss: 8,
  philhealth: 9,
  pagibig: 10,
  totalDeduction: 11,
  netAmount: 12,
  thirteenthMonthCutoff: 13,
  silCutoff: 14,
};

/** Compact Mike Razal — 19 columns (NIKKEI Barcelona: night diff + legal holiday). */
export const EXTERNAL_MR_19_LAYOUT: RegisterLayoutMap = {
  minColumns: 19,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  nightDiffHours: 5,
  nightDiffAmount: 6,
  totalOTAmount: 9,
  grossAmount: 10,
  sss: 11,
  philhealth: 12,
  pagibig: 13,
  otherDeduction: 14,
  totalDeduction: 15,
  netAmount: 16,
  thirteenthMonthCutoff: 17,
  silCutoff: 18,
};

/** Nabati head office — 19 columns (2nd cutoff, no pag-ibig column on total row). */
export const EXTERNAL_NABATI_HO_19_LAYOUT: RegisterLayoutMap = {
  minColumns: 19,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 7,
  transpoAllowance: 8,
  allowance: 9,
  grossAmount: 10,
  sss: 11,
  sssPRO: 12,
  philhealth: 13,
  totalDeduction: 14,
  netAmount: 15,
  thirteenthMonthCutoff: 16,
  silCutoff: 17,
};

/** Nabati head office — 22 columns (transpo + comm allowance). */
export const EXTERNAL_NABATI_HO_22_LAYOUT: RegisterLayoutMap = {
  minColumns: 22,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 9,
  transpoAllowance: 10,
  allowance: 11,
  grossAmount: 13,
  sss: 14,
  philhealth: 15,
  pagibig: 16,
  totalDeduction: 17,
  netAmount: 18,
  thirteenthMonthCutoff: 19,
  silCutoff: 20,
};

/** Mike Razal export — 17 columns (Viventis-style, no night diff). */
export const EXTERNAL_MR_17_LAYOUT: RegisterLayoutMap = {
  minColumns: 17,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 7,
  allowance: 8,
  grossAmount: 9,
  sss: 10,
  philhealth: 11,
  pagibig: 12,
  totalDeduction: 13,
  netAmount: 14,
  thirteenthMonthCutoff: 15,
  silCutoff: 16,
};

/** Mike Razal export — 23 columns (NIKKEI-style with night diff). */
export const EXTERNAL_MR_23_LAYOUT: RegisterLayoutMap = {
  minColumns: 23,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  nightDiffHours: 7,
  nightDiffAmount: 8,
  totalOTAmount: 9,
  grossAmount: 10,
  sss: 11,
  sssPRO: 12,
  philhealth: 13,
  pagibig: 14,
  sssLoan: 15,
  otherDeduction: 17,
  totalDeduction: 18,
  netAmount: 19,
  thirteenthMonthCutoff: 20,
  silCutoff: 21,
};

/** Vouno-style — restday OT + income adjustment columns. */
export const EXTERNAL_VOUNO_24_LAYOUT: RegisterLayoutMap = {
  minColumns: 24,
  dailyRate: 0,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  totalOTAmount: 11,
  grossAmount: 13,
  sss: 14,
  philhealth: 15,
  pagibig: 16,
  withholdingTax: 17,
  otherDeduction: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
};

/** Nabati wide register — meal/comm/gas allowance columns. */
export const EXTERNAL_NABATI_28_LAYOUT: RegisterLayoutMap = {
  minColumns: 28,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  regOTAmount: 6,
  nightDiffHours: 7,
  nightDiffAmount: 8,
  totalOTAmount: 9,
  serviceIncentiveLeaveAmount: 10,
  allowance: 11,
  grossAmount: 14,
  sss: 15,
  philhealth: 16,
  pagibig: 17,
  otherDeduction: 18,
  totalDeduction: 19,
  netAmount: 20,
  thirteenthMonthCutoff: 21,
  silCutoff: 22,
};

/** Levelwear wide register — legal/special holiday columns. */
export const EXTERNAL_LEVELWEAR_28_LAYOUT: RegisterLayoutMap = {
  minColumns: 28,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  totalOTAmount: 15,
  grossAmount: 18,
  sss: 19,
  philhealth: 20,
  pagibig: 21,
  withholdingTax: 22,
  totalDeduction: 23,
  netAmount: 24,
  thirteenthMonthCutoff: 25,
  silCutoff: 26,
};

/**
 * Levelwear cutoffs vary: some omit Legal/Special ND (gross @18), Dec–style
 * packs ND columns so gross lands @20. Anchor on Salaries and Wages when present.
 */
export function resolveLevelwear28Layout(
  text: string,
  nums: number[],
  isTotalRow = false
): RegisterLayoutMap {
  void isTotalRow;
  let grossAmount = 18;

  const footerMatch = text.match(/Salaries and Wages:\s*([\d,]+\.?\d*)/i);
  if (footerMatch && nums.length >= 21) {
    const footerGross = Number(footerMatch[1].replace(/,/g, ""));
    const idx = nums.findIndex((n) => Math.abs(n - footerGross) < 2);
    if (idx >= 0) grossAmount = idx;
  } else if (nums.length >= 28) {
    for (const idx of [20, 18]) {
      if ((nums[idx] ?? 0) > 50_000) {
        grossAmount = idx;
        break;
      }
    }
  }

  const hasSssPro = /SSS\s*Pro/i.test(text);
  const base: RegisterLayoutMap = {
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
    totalOTAmount: Math.max(0, grossAmount - 3),
    serviceIncentiveLeaveAmount: Math.max(0, grossAmount - 2),
    allowance: Math.max(0, grossAmount - 1),
    grossAmount,
    sss: grossAmount + 1,
  };

  if (hasSssPro) {
    return {
      ...base,
      sssPRO: grossAmount + 2,
      philhealth: grossAmount + 3,
      withholdingTax: grossAmount + 4,
      sssLoan: grossAmount + 5,
      totalDeduction: grossAmount + 7,
      // Net / SIL often only on employee rows or footer for this variant
      netAmount: grossAmount + 8,
      thirteenthMonthCutoff: grossAmount + 9,
      silCutoff: grossAmount + 10,
    };
  }

  return {
    ...base,
    philhealth: grossAmount + 2,
    pagibig: grossAmount + 3,
    withholdingTax: grossAmount + 4,
    totalDeduction: grossAmount + 5,
    netAmount: grossAmount + 6,
    thirteenthMonthCutoff: grossAmount + 7,
    silCutoff: grossAmount + 8,
  };
}

export function isLevelwearRegister(text?: string): boolean {
  if (!text) return false;
  if (/LEVELWEAR/i.test(text)) return true;
  // Converge packs Special Holiday2 / Income Adjustment — not Levelwear.
  if (/CONVERGE/i.test(text)) return false;
  if (/Special\s+Holiday\s*2/i.test(text)) return false;
  if (/Income\s+Adjustment/i.test(text)) return false;

  if (
    /Service\s+Incentive\s+Leave/i.test(text) &&
    /Legal\s+Holiday/i.test(text) &&
    /Special\s+Holiday/i.test(text)
  ) {
    return true;
  }

  // Older pdf-parse output used embedded newlines in header labels.
  if (
    text.includes("Special\nHoliday ND") ||
    (text.includes("Legal\nHoliday") && text.includes("Special\nHoliday"))
  ) {
    return /Service\s+Incentive\s+Leave/i.test(text) || /LEVELWEAR/i.test(text);
  }

  return false;
}

/** Chicha Hut 21-column totals row — gross aligns with employee rows at index 10. */
export const EXTERNAL_CHICHA_21_TOTAL_LAYOUT: RegisterLayoutMap = {
  minColumns: 21,
  hoursWorked: 1,
  daysWorked: 2,
  basicSalary: 3,
  totalSalary: 4,
  regOTHours: 5,
  totalOTAmount: 9,
  grossAmount: 10,
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
    regNightdiffOTHours: 0,
    regNightdiffOTAmount: 0,
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum of itemized OT / holiday pay columns (amounts only). */
export function sumOTPayComponents(row: PayrollRegisterRow): number {
  return round2(
    row.regOTAmount +
      row.nightDiffAmount +
      row.regNightdiffOTAmount +
      row.specialHolidayAmount +
      row.specialHolidayOTAmount +
      row.restdayAmount
  );
}

/** Keep earnings fields consistent with gross when layouts overlap OT columns. */
function reconcileRegisterRowEarnings(row: PayrollRegisterRow): void {
  if (row.grossAmount <= 0) return;

  const otComponents = sumOTPayComponents(row);
  const base =
    row.totalSalary +
    otComponents +
    row.serviceIncentiveLeaveAmount +
    row.transpoAllowance +
    row.loadAllowance +
    row.allowance +
    row.refund;

  if (base >= row.grossAmount - 0.02) {
    row.totalOTAmount = 0;
    return;
  }

  const gap = round2(row.grossAmount - base);
  if (gap <= 0.01) {
    row.totalOTAmount = 0;
    return;
  }

  if (row.totalOTAmount > gap + 0.02) {
    row.totalOTAmount = gap;
  } else if (row.totalOTAmount <= 0.01) {
    row.totalOTAmount = gap;
  }

  // Total OT column is often the sum of itemized OT pay — drop duplicate subtotal.
  if (
    row.totalOTAmount > 0 &&
    otComponents > 0 &&
    Math.abs(row.totalOTAmount - otComponents) <= 0.05
  ) {
    row.totalOTAmount = 0;
  }
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
  reconcileRegisterRowEarnings(row);
  return row;
}

function isNabatiEddRegister(text?: string): boolean {
  return (
    text?.includes("NABATI FOOD") === true ||
    text?.includes("Gas & Motor") === true ||
    text?.includes("Meal\nAllowance") === true
  );
}

function isChichaRegister(text?: string): boolean {
  return (
    text?.includes("CHICHA") === true ||
    (text?.includes("NightDiff") === true &&
      text?.includes("Gas & Motor") !== true)
  );
}

function layoutFromDetectedHeaders(
  text: string,
  tokenCount: number,
  nums?: number[],
  isTotalRow = false
): RegisterLayoutMap[] {
  const layouts: RegisterLayoutMap[] = [];
  const counts = new Set<number>([tokenCount]);
  const inferred = inferRegisterColumnCount(text);
  if (inferred) counts.add(inferred);

  for (const count of counts) {
    const detected = detectExternalRegisterLayout(text, count);
    if (!detected) continue;

    if (count >= EXTERNAL_EARNINGS_28_LAYOUT.minColumns && nums) {
      layouts.push({
        ...detected.layout,
        ...resolveConverge28TailLayout(nums, isTotalRow),
      });
    } else {
      layouts.push(detected.layout);
    }
  }
  return layouts;
}

/** Lower score = better alignment with totals row earnings / net. */
export function scoreRegisterLayout(
  nums: number[],
  layout: RegisterLayoutMap
): number {
  const row = parseRegisterRow("Total", nums, layout);
  if (!row || row.grossAmount <= 0) return Number.POSITIVE_INFINITY;

  const earnings =
    row.totalSalary +
    row.regOTAmount +
    row.nightDiffAmount +
    row.regNightdiffOTAmount +
    row.specialHolidayAmount +
    row.specialHolidayOTAmount +
    row.restdayAmount +
    row.serviceIncentiveLeaveAmount +
    row.transpoAllowance +
    row.loadAllowance +
    row.allowance +
    row.refund +
    row.totalOTAmount;

  const unmapped = Math.max(0, round2(row.grossAmount - earnings));
  const deductions =
    row.sss +
    row.sssPRO +
    row.philhealth +
    row.pagibig +
    row.withholdingTax +
    row.sssLoan +
    row.otherDeduction;
  const netDrift = Math.abs(round2(row.grossAmount - deductions - row.netAmount));
  const dedDrift =
    row.totalDeduction > 0
      ? Math.abs(round2(deductions - row.totalDeduction))
      : 0;

  return unmapped + netDrift + dedDrift;
}

function resolveStaticExternalRegisterLayout(
  tokenCount: number,
  text?: string,
  nums?: number[],
  options?: { isTotalRow?: boolean }
): RegisterLayoutMap | null {
  if (tokenCount === EXTERNAL_COMPACT_12_LAYOUT.minColumns) {
    return EXTERNAL_COMPACT_12_LAYOUT;
  }
  if (
    tokenCount === EXTERNAL_COMPACT_13_LAYOUT.minColumns ||
    tokenCount === 14
  ) {
    return EXTERNAL_COMPACT_13_LAYOUT;
  }
  if (tokenCount >= 15 && tokenCount <= EXTERNAL_COMPACT_16_LAYOUT.minColumns) {
    return EXTERNAL_COMPACT_16_LAYOUT;
  }
  if (tokenCount >= EXTERNAL_EARNINGS_28_LAYOUT.minColumns) {
    if (
      text &&
      nums &&
      isGpInternalPayrollRegister(text, nums, options?.isTotalRow)
    ) {
      return resolveGpInternal28Layout(text, nums, options?.isTotalRow ?? false);
    }
    if (isNabatiEddRegister(text)) {
      return EXTERNAL_NABATI_28_LAYOUT;
    }
    if (isLevelwearRegister(text)) {
      return resolveLevelwear28Layout(
        text ?? "",
        nums ?? [],
        options?.isTotalRow ?? false
      );
    }
    if (nums) {
      return mergeConverge28Layout(nums, options?.isTotalRow ?? false);
    }
    return EXTERNAL_EARNINGS_28_LAYOUT;
  }
  if (tokenCount === 25 && text?.includes("SH Restday")) {
    return EXTERNAL_GOLDILOCKS_25_LAYOUT;
  }
  if (tokenCount === 24 && isNabatiEddRegister(text)) {
    return EXTERNAL_NABATI_EDD_24_LAYOUT;
  }
  if (tokenCount === 23) {
    if (
      text?.includes("Special\nHoliday") &&
      text?.includes("Restday OT") &&
      !text?.includes("Working")
    ) {
      return EXTERNAL_COMCLARK_23_LAYOUT;
    }
    if (text?.includes("Restday OT") && text?.includes("Working")) {
      return EXTERNAL_VOUNO_23_LAYOUT;
    }
    if (text?.includes("Income\nAdjustment") && !text?.includes("Transpo")) {
      return EXTERNAL_VOUNO_24_LAYOUT;
    }
    return EXTERNAL_MR_23_LAYOUT;
  }
  if (tokenCount === 22) {
    if (text?.includes("Reg Nightdiff") && isNabatiEddRegister(text)) {
      return EXTERNAL_NABATI_EDD_22_LAYOUT;
    }
    if (
      text?.includes("Transpo\nAllowance") ||
      (isNabatiEddRegister(text) && text?.includes("COMM"))
    ) {
      return EXTERNAL_NABATI_HO_22_LAYOUT;
    }
    if (
      text?.includes("Restday OT") ||
      text?.includes("Income\nAdjustment")
    ) {
      return EXTERNAL_VOUNO_24_LAYOUT;
    }
    return EXTERNAL_MR_23_LAYOUT;
  }
  if (tokenCount === 24 && isChichaRegister(text)) {
    return EXTERNAL_CHICHA_24_LAYOUT;
  }
  if (tokenCount === 21) {
    if (isNabatiEddRegister(text) && text?.includes("Legal\nHoliday")) {
      return EXTERNAL_NABATI_EDD_21_LAYOUT;
    }
    if (isChichaRegister(text)) {
      return options?.isTotalRow
        ? EXTERNAL_CHICHA_21_TOTAL_LAYOUT
        : EXTERNAL_CHICHA_21_LAYOUT;
    }
    if (isNabatiEddRegister(text)) {
      return EXTERNAL_NABATI_EDD_21_LAYOUT;
    }
    return options?.isTotalRow
      ? EXTERNAL_CHICHA_21_TOTAL_LAYOUT
      : EXTERNAL_CHICHA_21_LAYOUT;
  }
  if (tokenCount >= 19 && tokenCount <= 20) {
    if (text?.includes("Legal\nHoliday") && !isNabatiEddRegister(text)) {
      return EXTERNAL_MR_19_LAYOUT;
    }
    if (isNabatiEddRegister(text) && tokenCount === 19) {
      return EXTERNAL_NABATI_EDD_19_LAYOUT;
    }
    if (
      text?.includes("Transpo\nAllowance") ||
      (isNabatiEddRegister(text) && tokenCount === 19)
    ) {
      return EXTERNAL_NABATI_HO_19_LAYOUT;
    }
    if (
      text?.includes("Restday OT") ||
      text?.includes("Income\nAdjustment")
    ) {
      return tokenCount === 20
        ? EXTERNAL_VOUNO_20_LAYOUT
        : EXTERNAL_VOUNO_24_LAYOUT;
    }
    if (tokenCount === 20) {
      return EXTERNAL_VOUNO_20_LAYOUT;
    }
    return EXTERNAL_KRR_19_LAYOUT;
  }
  if (tokenCount >= 17 && tokenCount <= 18) {
    return EXTERNAL_MR_17_LAYOUT;
  }
  if (tokenCount >= EXTERNAL_CHICHA_24_LAYOUT.minColumns && isChichaRegister(text)) {
    return EXTERNAL_CHICHA_24_LAYOUT;
  }
  return null;
}

/** Resolve layout: static templates by default; header-driven when no template or clearly better on totals. */
export function resolveExternalRegisterLayout(
  tokenCount: number,
  text?: string,
  nums?: number[],
  options?: { isTotalRow?: boolean }
): RegisterLayoutMap | null {
  const staticLayout = resolveStaticExternalRegisterLayout(
    tokenCount,
    text,
    nums,
    options
  );

  if (text) {
    const fromHeaders = layoutFromDetectedHeaders(
      text,
      tokenCount,
      nums,
      options?.isTotalRow
    );
    const headerLayout = fromHeaders[0];

    if (headerLayout) {
      if (!staticLayout) return headerLayout;

      if (
        options?.isTotalRow &&
        nums &&
        nums.length >= headerLayout.minColumns
      ) {
        const headerScore = scoreRegisterLayout(nums, headerLayout);
        const staticScore = scoreRegisterLayout(nums, staticLayout);
        if (headerScore < staticScore - 0.5) return headerLayout;
      }
    }
  }

  return staticLayout;
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
