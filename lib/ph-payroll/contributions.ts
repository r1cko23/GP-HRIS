/**
 * SSS / PhilHealth / Pag-IBIG / BIR tables (PH payroll formulas).
 * Callers should use getCutoffStatutoryDeductions for kinsenas EE amounts.
 */

import type { TaxFrequency } from "./types";

export type { TaxFrequency };

/**
 * SSS Contribution Brackets (2025–2026)
 * Based on monthly salary credit (MSC)
 * Employee share: 5% of MSC, Employer share: 10% of MSC
 * Total: 15% of MSC
 * Minimum MSC: ₱5,000, Maximum MSC: ₱35,000
 * Schedule unchanged for 2026 (RA 11199 final 15% rate).
 */
const SSS_BRACKETS = [
  { min: 5000, max: 5249.99, msc: 5000 },
  { min: 5250, max: 5749.99, msc: 5500 },
  { min: 5750, max: 6249.99, msc: 6000 },
  { min: 6250, max: 6749.99, msc: 6500 },
  { min: 6750, max: 7249.99, msc: 7000 },
  { min: 7250, max: 7749.99, msc: 7500 },
  { min: 7750, max: 8249.99, msc: 8000 },
  { min: 8250, max: 8749.99, msc: 8500 },
  { min: 8750, max: 9249.99, msc: 9000 },
  { min: 9250, max: 9749.99, msc: 9500 },
  { min: 9750, max: 10249.99, msc: 10000 },
  { min: 10250, max: 10749.99, msc: 10500 },
  { min: 10750, max: 11249.99, msc: 11000 },
  { min: 11250, max: 11749.99, msc: 11500 },
  { min: 11750, max: 12249.99, msc: 12000 },
  { min: 12250, max: 12749.99, msc: 12500 },
  { min: 12750, max: 13249.99, msc: 13000 },
  { min: 13250, max: 13749.99, msc: 13500 },
  { min: 13750, max: 14249.99, msc: 14000 },
  { min: 14250, max: 14749.99, msc: 14500 },
  { min: 14750, max: 15249.99, msc: 15000 },
  { min: 15250, max: 15749.99, msc: 15500 },
  { min: 15750, max: 16249.99, msc: 16000 },
  { min: 16250, max: 16749.99, msc: 16500 },
  { min: 16750, max: 17249.99, msc: 17000 },
  { min: 17250, max: 17749.99, msc: 17500 },
  { min: 17750, max: 18249.99, msc: 18000 },
  { min: 18250, max: 18749.99, msc: 18500 },
  { min: 18750, max: 19249.99, msc: 19000 },
  { min: 19250, max: 19749.99, msc: 19500 },
  { min: 19750, max: 20249.99, msc: 20000 },
  { min: 20250, max: 20749.99, msc: 20500 },
  { min: 20750, max: 21249.99, msc: 21000 },
  { min: 21250, max: 21749.99, msc: 21500 },
  { min: 21750, max: 22249.99, msc: 22000 },
  { min: 22250, max: 22749.99, msc: 22500 },
  { min: 22750, max: 23249.99, msc: 23000 },
  { min: 23250, max: 23749.99, msc: 23500 },
  { min: 23750, max: 24249.99, msc: 24000 },
  { min: 24250, max: 24749.99, msc: 24500 },
  { min: 24750, max: 25249.99, msc: 25000 },
  { min: 25250, max: 25749.99, msc: 25500 },
  { min: 25750, max: 26249.99, msc: 26000 },
  { min: 26250, max: 26749.99, msc: 26500 },
  { min: 26750, max: 27249.99, msc: 27000 },
  { min: 27250, max: 27749.99, msc: 27500 },
  { min: 27750, max: 28249.99, msc: 28000 },
  { min: 28250, max: 28749.99, msc: 28500 },
  { min: 28750, max: 29249.99, msc: 29000 },
  { min: 29250, max: 29749.99, msc: 29500 },
  { min: 29750, max: 30000, msc: 30000 },
  { min: 30000.01, max: 30749.99, msc: 30500 },
  { min: 30750, max: 31499.99, msc: 31000 },
  { min: 31500, max: 32249.99, msc: 31500 },
  { min: 32250, max: 32999.99, msc: 32000 },
  { min: 33000, max: 33749.99, msc: 32500 },
  { min: 33750, max: 34249.99, msc: 34000 },
  { min: 34250, max: 34749.99, msc: 34500 },
  { min: 34750, max: 999999, msc: 35000 },
  // Above 34,750 uses fixed MSC of 35,000 (per official SSS table 2025)
];

const SSS_EMPLOYEE_RATE = 0.05; // 5%
const SSS_EMPLOYER_RATE = 0.1; // 10%
const SSS_TOTAL_RATE = 0.15; // 15%

/**
 * Pag-IBIG (HDMF Circular 460, effective Feb 2024 — unchanged 2026)
 * Fund salary capped at ₱10,000 Maximum Fund Salary (MFS).
 * ≤ ₱1,500: EE 1%, ER 2%; above ₱1,500: EE 2%, ER 2%.
 * Max EE ₱200 / ER ₱200 per month at the MFS cap.
 */
const PAGIBIG_MAX_FUND_SALARY = 10000;
const PAGIBIG_LOW_SALARY_THRESHOLD = 1500;
const PAGIBIG_LOW_EE_RATE = 0.01;
const PAGIBIG_LOW_ER_RATE = 0.02;
const PAGIBIG_STANDARD_RATE = 0.02;

function pagibigFundSalary(monthlySalary: number): number {
  if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) return 0;
  return Math.min(PAGIBIG_MAX_FUND_SALARY, monthlySalary);
}

/**
 * Calculate Pag-IBIG mandatory savings (employee + employer shares).
 */
export function calculatePagIBIG(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
  fundSalary: number;
} {
  const fundSalary = pagibigFundSalary(monthlySalary);
  if (fundSalary <= 0) {
    return { employeeShare: 0, employerShare: 0, total: 0, fundSalary: 0 };
  }

  const employeeRate =
    fundSalary <= PAGIBIG_LOW_SALARY_THRESHOLD
      ? PAGIBIG_LOW_EE_RATE
      : PAGIBIG_STANDARD_RATE;
  const employerRate =
    fundSalary <= PAGIBIG_LOW_SALARY_THRESHOLD
      ? PAGIBIG_LOW_ER_RATE
      : PAGIBIG_STANDARD_RATE;

  const employeeShare = fundSalary * employeeRate;
  const employerShare = fundSalary * employerRate;
  const total = employeeShare + employerShare;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
    fundSalary,
  };
}

/**
 * PhilHealth premium (2025–2026, RA 11223 / UHC)
 * 5% of monthly basic salary with ₱10,000 floor and ₱100,000 ceiling.
 * Employee share: 2.5%; employer share: 2.5%.
 */
const PHILHEALTH_EMPLOYEE_RATE = 0.025; // 2.5% employee share
const PHILHEALTH_EMPLOYER_RATE = 0.025; // 2.5% employer share
const PHILHEALTH_TOTAL_RATE = 0.05; // 5% total

/**
 * Calculate monthly salary from daily rate
 * @param dailyRate Daily rate in PHP (keep full precision; do not pre-round to 2dp)
 * @param workingDaysPerMonth Number of working days per month (default: 22)
 * @returns Monthly salary rounded to centavos
 */
export function calculateMonthlySalary(
  dailyRate: number,
  workingDaysPerMonth: number = 22
): number {
  return Math.round(dailyRate * workingDaysPerMonth * 100) / 100;
}

/**
 * Find SSS bracket based on monthly salary
 */
function findSSSBracket(monthlySalary: number): number {
  // If salary exceeds max bracket, use max MSC
  if (monthlySalary > 35000) {
    return 35000;
  }

  // If salary is below minimum, use minimum MSC
  if (monthlySalary < 5000) {
    return 5000;
  }

  // Find matching bracket
  for (const bracket of SSS_BRACKETS) {
    if (monthlySalary >= bracket.min && monthlySalary <= bracket.max) {
      return bracket.msc;
    }
  }

  // Default to minimum bracket
  return SSS_BRACKETS[0].msc;
}

const SSS_ECC_LOW = 10;
const SSS_ECC_HIGH = 30;
const SSS_ECC_MSC_THRESHOLD = 15000;

/**
 * Employees' Compensation (EC) — employer-only, per SSS contribution schedule.
 * MSC ₱14,500 and below → ₱10/mo; MSC ₱15,000 and above → ₱30/mo.
 */
export function calculateSssEcc(msc: number): number {
  if (!Number.isFinite(msc) || msc <= 0) return 0;
  return msc >= SSS_ECC_MSC_THRESHOLD ? SSS_ECC_HIGH : SSS_ECC_LOW;
}

/**
 * Calculate SSS contribution (including WISP/MPF for MSC > PHP 20,000)
 * Effective January 1, 2025 (unchanged 2026):
 * - Regular SSS: MSC up to PHP 20,000 (15% total: 5% employee, 10% employer)
 * - WISP (Workers' Investment and Savings Program): Mandatory for MSC > PHP 20,000
 *   - WISP MSC = Excess over PHP 20,000 (up to PHP 35,000 max)
 *   - WISP Contribution: 15% of WISP MSC (5% employee, 10% employer)
 *
 * @param monthlySalary Monthly salary
 * @returns Object with employee share, employer share, total, msc, and WISP breakdown
 */
export function calculateSSS(monthlySalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
  msc: number;
  regularMsc: number;
  wispMsc: number;
  regularEmployeeShare: number;
  regularEmployerShare: number;
  wispEmployeeShare: number;
  wispEmployerShare: number;
  ecc: number;
} {
  const msc = findSSSBracket(monthlySalary);

  // WISP is mandatory for MSC > PHP 20,000 (effective January 1, 2025)
  const WISP_THRESHOLD = 20000;
  const MAX_MSC = 35000;

  let regularMsc = msc;
  let wispMsc = 0;

  if (msc > WISP_THRESHOLD) {
    // Regular SSS: MSC up to PHP 20,000
    regularMsc = WISP_THRESHOLD;
    // WISP: Excess over PHP 20,000 (capped at PHP 35,000 total MSC)
    wispMsc = Math.min(msc, MAX_MSC) - WISP_THRESHOLD;
  }

  // Regular SSS contributions
  const regularEmployeeShare = regularMsc * SSS_EMPLOYEE_RATE;
  const regularEmployerShare = regularMsc * SSS_EMPLOYER_RATE;

  // WISP contributions (if applicable)
  const wispEmployeeShare = wispMsc * SSS_EMPLOYEE_RATE;
  const wispEmployerShare = wispMsc * SSS_EMPLOYER_RATE;

  // Total contributions
  const employeeShare = regularEmployeeShare + wispEmployeeShare;
  const employerShare = regularEmployerShare + wispEmployerShare;
  const total = employeeShare + employerShare;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
    msc,
    regularMsc,
    wispMsc,
    regularEmployeeShare: Math.round(regularEmployeeShare * 100) / 100,
    regularEmployerShare: Math.round(regularEmployerShare * 100) / 100,
    wispEmployeeShare: Math.round(wispEmployeeShare * 100) / 100,
    wispEmployerShare: Math.round(wispEmployerShare * 100) / 100,
    ecc: calculateSssEcc(msc),
  };
}

/**
 * PhilHealth premium (2025–2026, RA 11223 / UHC)
 * 5% of monthly basic salary with ₱10,000 floor and ₱100,000 ceiling.
 * Employee share: 2.5%; employer share: 2.5%.
 */
const PHILHEALTH_SALARY_FLOOR = 10000;
const PHILHEALTH_SALARY_CEILING = 100000;

function philHealthPremiumBase(monthlyBasicSalary: number): number {
  if (monthlyBasicSalary <= 0) return 0;
  return Math.min(
    PHILHEALTH_SALARY_CEILING,
    Math.max(PHILHEALTH_SALARY_FLOOR, monthlyBasicSalary)
  );
}

/**
 * Calculate PhilHealth contribution
 * @param monthlyBasicSalary Monthly basic salary
 * @returns Object with employee share, employer share, and total
 */
export function calculatePhilHealth(monthlyBasicSalary: number): {
  employeeShare: number;
  employerShare: number;
  total: number;
  premiumBase: number;
} {
  const validSalary =
    typeof monthlyBasicSalary === "number" &&
    !isNaN(monthlyBasicSalary) &&
    monthlyBasicSalary >= 0
      ? monthlyBasicSalary
      : 0;

  const premiumBase = philHealthPremiumBase(validSalary);
  if (premiumBase <= 0) {
    return { employeeShare: 0, employerShare: 0, total: 0, premiumBase: 0 };
  }

  const employeeShare = premiumBase * PHILHEALTH_EMPLOYEE_RATE;
  const employerShare = premiumBase * PHILHEALTH_EMPLOYER_RATE;
  const total = premiumBase * PHILHEALTH_TOTAL_RATE;

  return {
    employeeShare: Math.round(employeeShare * 100) / 100,
    employerShare: Math.round(employerShare * 100) / 100,
    total: Math.round(total * 100) / 100,
    premiumBase,
  };
}

/**
 * BIR Revised Withholding Tax Tables — Effective January 1, 2023 and onwards.
 * Still the official table for 2026 (TRAIN Law Phase 2; no new bracket schedule).
 * Source: bir.gov.ph/income-tax
 *
 * 2026 note: RR 29-2025 updated de minimis benefit ceilings (Jan 6, 2026), not these brackets.
 */

type TaxBracket = {
  maxComp: number;
  prescribedTax: number;
  rate: number;
  over: number;
};

const BIR_DAILY_TAX_TABLE: TaxBracket[] = [
  { maxComp: 685, prescribedTax: 0, rate: 0, over: 0 },
  { maxComp: 1095, prescribedTax: 0, rate: 0.15, over: 685 },
  { maxComp: 2191, prescribedTax: 61.65, rate: 0.2, over: 1096 },
  { maxComp: 5478, prescribedTax: 280.85, rate: 0.25, over: 2192 },
  { maxComp: 21917, prescribedTax: 1102.6, rate: 0.3, over: 5479 },
  { maxComp: Infinity, prescribedTax: 6034.3, rate: 0.35, over: 21918 },
];

const BIR_WEEKLY_TAX_TABLE: TaxBracket[] = [
  { maxComp: 4808, prescribedTax: 0, rate: 0, over: 0 },
  { maxComp: 7691, prescribedTax: 0, rate: 0.15, over: 4808 },
  { maxComp: 15384, prescribedTax: 432.6, rate: 0.2, over: 7692 },
  { maxComp: 38461, prescribedTax: 1971.2, rate: 0.25, over: 15385 },
  { maxComp: 153845, prescribedTax: 7740.45, rate: 0.3, over: 38462 },
  { maxComp: Infinity, prescribedTax: 42355.65, rate: 0.35, over: 153846 },
];

/** Primary table for bi-monthly (kinsenas) payroll. */
const BIR_SEMIMONTHLY_TAX_TABLE: TaxBracket[] = [
  { maxComp: 10417, prescribedTax: 0, rate: 0, over: 0 },
  { maxComp: 16666, prescribedTax: 0, rate: 0.15, over: 10417 },
  { maxComp: 33332, prescribedTax: 937.5, rate: 0.2, over: 16667 },
  { maxComp: 83332, prescribedTax: 4270.7, rate: 0.25, over: 33333 },
  { maxComp: 333332, prescribedTax: 16770.7, rate: 0.3, over: 83333 },
  { maxComp: Infinity, prescribedTax: 91770.7, rate: 0.35, over: 333333 },
];

const BIR_MONTHLY_TAX_TABLE: TaxBracket[] = [
  { maxComp: 20833, prescribedTax: 0, rate: 0, over: 0 },
  { maxComp: 33332, prescribedTax: 0, rate: 0.15, over: 20833 },
  { maxComp: 66666, prescribedTax: 1875.0, rate: 0.2, over: 33333 },
  { maxComp: 166666, prescribedTax: 8541.8, rate: 0.25, over: 66667 },
  { maxComp: 666666, prescribedTax: 33541.8, rate: 0.3, over: 166667 },
  { maxComp: Infinity, prescribedTax: 183541.8, rate: 0.35, over: 666667 },
];

function getTaxTable(frequency: TaxFrequency): TaxBracket[] {
  switch (frequency) {
    case "daily":
      return BIR_DAILY_TAX_TABLE;
    case "weekly":
      return BIR_WEEKLY_TAX_TABLE;
    case "monthly":
      return BIR_MONTHLY_TAX_TABLE;
    case "semi-monthly":
    default:
      return BIR_SEMIMONTHLY_TAX_TABLE;
  }
}

export type WithholdingTaxBreakdown = {
  taxableIncome: number;
  frequency: TaxFrequency;
  rangeIndex: number;
  rangeLabel: string;
  prescribedTax: number;
  ratePercent: number;
  excessOver: number;
  excessAmount: number;
  taxOnExcess: number;
  withholdingTax: number;
};

/**
 * Get BIR withholding tax breakdown for display (e.g. payslip tooltip).
 * Default: semi-monthly table (standard PH kinsenas payroll).
 */
export function getWithholdingTaxBreakdown(
  taxableIncome: number,
  frequency: TaxFrequency = "semi-monthly"
): WithholdingTaxBreakdown {
  const income =
    typeof taxableIncome === "number" && !isNaN(taxableIncome) && taxableIncome >= 0
      ? taxableIncome
      : 0;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const table = getTaxTable(frequency);

  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (income <= row.maxComp) {
      const excessAmount = Math.max(0, income - row.over);
      const taxOnExcess = round2(excessAmount * row.rate);
      const withholdingTax = round2(row.prescribedTax + taxOnExcess);
      const rangeLabel =
        i === 0
          ? `₱${row.over.toLocaleString()} and below`
          : i === table.length - 1
            ? `Over ₱${row.over.toLocaleString()}`
            : `₱${row.over.toLocaleString()} – ₱${row.maxComp.toLocaleString()}`;
      return {
        taxableIncome: income,
        frequency,
        rangeIndex: i + 1,
        rangeLabel,
        prescribedTax: row.prescribedTax,
        ratePercent: row.rate * 100,
        excessOver: row.over,
        excessAmount: round2(excessAmount),
        taxOnExcess,
        withholdingTax,
      };
    }
  }

  const last = table[table.length - 1];
  return {
    taxableIncome: income,
    frequency,
    rangeIndex: table.length,
    rangeLabel: `Over ₱${last.over.toLocaleString()}`,
    prescribedTax: last.prescribedTax,
    ratePercent: last.rate * 100,
    excessOver: last.over,
    excessAmount: 0,
    taxOnExcess: 0,
    withholdingTax: 0,
  };
}

/** Semi-monthly withholding tax (default for bi-monthly payroll). */
export function calculateSemiMonthlyWithholdingTax(
  semiMonthlyTaxableIncome: number
): number {
  return getWithholdingTaxBreakdown(semiMonthlyTaxableIncome, "semi-monthly")
    .withholdingTax;
}

/**
 * Monthly withholding tax (full-month taxable income).
 * @deprecated Prefer calculateSemiMonthlyWithholdingTax per cutoff for kinsenas payroll.
 */
export function calculateWithholdingTax(monthlyTaxableIncome: number): number {
  return getWithholdingTaxBreakdown(monthlyTaxableIncome, "monthly").withholdingTax;
}

/**
 * Calculate all government contributions for semi-monthly payroll
 * @param dailyRate Daily rate in PHP
 * @param workingDaysPerMonth Number of working days per month (default: 22)
 * @returns Monthly contribution tables plus `biMonthly` employee shares for the 2nd cutoff (full monthly amounts withheld once per month)
 */
export function calculateAllContributions(
  dailyRate: number,
  workingDaysPerMonth: number = 22
): {
  monthlySalary: number;
  sss: {
    employeeShare: number;
    employerShare: number;
    total: number;
    msc: number;
  };
  pagibig: {
    employeeShare: number;
    employerShare: number;
    total: number;
  };
  philhealth: {
    employeeShare: number;
    employerShare: number;
    total: number;
  };
  biMonthly: {
    sss: number;
    pagibig: number;
    philhealth: number;
  };
} {
  const monthlySalary = calculateMonthlySalary(dailyRate, workingDaysPerMonth);
  const sss = calculateSSS(monthlySalary);
  const pagibig = calculatePagIBIG(monthlySalary);
  const philhealth = calculatePhilHealth(monthlySalary);

  return {
    monthlySalary,
    sss,
    pagibig,
    philhealth,
    biMonthly: {
      sss: Math.round(sss.employeeShare * 100) / 100,
      pagibig: Math.round(pagibig.employeeShare * 100) / 100,
      philhealth: Math.round(philhealth.employeeShare * 100) / 100,
    },
  };
}