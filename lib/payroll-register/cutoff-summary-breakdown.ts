/**
 * Grouped payroll summary totals — mirrors MAIN Payroll Summary footer sections
 * (Earnings, Deductions, Employee/Employer share, Accruals) for cutoff hub UI.
 */

import { sumEmployeeCategories } from "@/lib/payroll-summary/category-breakdown";
import {
  bucketFundingPeople,
  parseFundingPayThrough,
  type FundingPerson,
} from "./funding-memo";
import {
  laterCutoffBasicsForName,
  matchScrapedAccrual,
  type ScrapedAccrual,
} from "./main-accrual-overlay";
import { organicRegisterLineToAuditRow } from "./organic-register-to-audit-row";
import {
  aggregateAllowanceLinesByKey,
  type AllowanceLine,
} from "./allowance-lines";
import {
  aggregateOtherDeductionLinesByKey,
  sumOtherDeductionLines,
  type OtherDeductionLine,
} from "./other-deduction-lines";

export type CutoffSummaryBreakdownLine = {
  directory_employee_id?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  hours?: Record<string, number> | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  loan_lines?: Array<{
    loan_type?: string | null;
    particular?: string | null;
    amount?: number | null;
  }> | null;
  other_deduction_lines?: OtherDeductionLine[] | null;
  allowance_lines?: AllowanceLine[] | null;
  /** Frozen on the register line at draft build — prefer over live Directory. */
  pay_through?: string | null;
  bank_account_no?: string | null;
  bank_name?: string | null;
  gcash?: string | null;
};

export type CutoffSummaryBreakdownItem = {
  key: string;
  label: string;
  amount: number;
};

export type CutoffSummaryBreakdownSection = {
  title: string;
  items: CutoffSummaryBreakdownItem[];
};

export type CutoffSummaryBreakdown = {
  earnings: CutoffSummaryBreakdownSection;
  deductions: CutoffSummaryBreakdownSection;
  employeeShare: CutoffSummaryBreakdownSection;
  employerShare: CutoffSummaryBreakdownSection;
  accruals13th: CutoffSummaryBreakdownSection;
  accrualsSil: CutoffSummaryBreakdownSection;
};

/** Default MAIN footer order. When register search/filter is on, lead with accruals
 * so YTD / SIL stay visible above the tall earnings column. */
export function orderedCutoffSummarySections(
  breakdown: CutoffSummaryBreakdown,
  opts?: { prioritizeAccruals?: boolean }
): CutoffSummaryBreakdownSection[] {
  const main = [
    breakdown.earnings,
    breakdown.deductions,
    breakdown.employeeShare,
    breakdown.employerShare,
    breakdown.accruals13th,
    breakdown.accrualsSil,
  ];
  if (!opts?.prioritizeAccruals) return main;
  return [
    breakdown.accruals13th,
    breakdown.accrualsSil,
    breakdown.earnings,
    breakdown.deductions,
    breakdown.employeeShare,
    breakdown.employerShare,
  ];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function pickStored(d: Record<string, unknown>, key: string, fallback: number) {
  if (Object.prototype.hasOwnProperty.call(d, key) && d[key] != null) {
    return n(d[key]);
  }
  return fallback;
}

type LoanSplit = {
  sssLoan: number;
  sssCalamityLoan: number;
  pagibigLoan: number;
  pagibigCalamityLoan: number;
  pagibigMpl: number;
  pagibigSafe: number;
  companyLoan: number;
  emergencyLoan: number;
  /** Not a typed loan (e.g. HMO wrongly stored on loan_lines) → Other deduction. */
  otherLoans: number;
  /** MAIN credit rows still on loan_lines (amount < 0) → Refund under Earnings. */
  refundCredits: number;
};

function splitLoans(line: CutoffSummaryBreakdownLine): LoanSplit {
  const empty: LoanSplit = {
    sssLoan: 0,
    sssCalamityLoan: 0,
    pagibigLoan: 0,
    pagibigCalamityLoan: 0,
    pagibigMpl: 0,
    pagibigSafe: 0,
    companyLoan: 0,
    emergencyLoan: 0,
    otherLoans: 0,
    refundCredits: 0,
  };
  const loanLines = line.loan_lines ?? [];
  if (!loanLines.length) {
    const lump = n(line.deductions?.loans);
    if (lump < 0) {
      return { ...empty, refundCredits: round2(Math.abs(lump)) };
    }
    return { ...empty, otherLoans: lump };
  }

  const out = { ...empty };
  for (const row of loanLines) {
    const amount = n(row.amount);
    if (amount === 0) continue;
    // MAIN / catalog credits: never drop — show under Refund.
    if (amount < 0) {
      out.refundCredits += Math.abs(amount);
      continue;
    }
    const type = String(row.loan_type ?? "").toLowerCase();
    const particular = String(
      (row as { particular?: string | null }).particular ?? ""
    ).toLowerCase();
    // HMO / cash-advance noise on loan_lines stays under Other deduction.
    if (particular.includes("hmo")) {
      out.otherLoans += amount;
      continue;
    }
    if (type === "sss") out.sssLoan += amount;
    else if (type === "sss_calamity") out.sssCalamityLoan += amount;
    else if (type === "pagibig") out.pagibigLoan += amount;
    else if (type === "pagibig_calamity") out.pagibigCalamityLoan += amount;
    else if (type === "pagibig_mpl") out.pagibigMpl += amount;
    else if (type === "pagibig_safe") out.pagibigSafe += amount;
    else if (type === "company") out.companyLoan += amount;
    else if (type === "emergency") out.emergencyLoan += amount;
    else out.otherLoans += amount;
  }
  return {
    sssLoan: round2(out.sssLoan),
    sssCalamityLoan: round2(out.sssCalamityLoan),
    pagibigLoan: round2(out.pagibigLoan),
    pagibigCalamityLoan: round2(out.pagibigCalamityLoan),
    pagibigMpl: round2(out.pagibigMpl),
    pagibigSafe: round2(out.pagibigSafe),
    companyLoan: round2(out.companyLoan),
    emergencyLoan: round2(out.emergencyLoan),
    otherLoans: round2(out.otherLoans),
    refundCredits: round2(out.refundCredits),
  };
}

function employerShares(line: CutoffSummaryBreakdownLine) {
  const deductions = (line.deductions ?? {}) as Record<string, unknown>;
  // Use register-stored ER only (organic compute or MAIN catalog import).
  // Do not estimate from monthly salary — MAIN basis differs and overstates totals.
  return {
    sss: pickStored(deductions, "sss_er", 0),
    sssProvident: pickStored(deductions, "sss_wisp_er", 0),
    ecc: pickStored(deductions, "sss_ecc", 0),
    pagibig: pickStored(deductions, "pagibig_er", 0),
    philhealth: pickStored(deductions, "philhealth_er", 0),
  };
}

function fundingTotals(people: FundingPerson[]) {
  const buckets = bucketFundingPeople(people);
  const byChannel = Object.fromEntries(
    buckets.map((bucket) => [bucket.channel, bucket.total])
  ) as Record<string, number>;
  return {
    cashInBank: round2(byChannel.cheque ?? 0),
    salaryCredit: round2(byChannel.atm ?? 0),
    gcash: round2(byChannel.gcash ?? 0),
    hold: round2(byChannel.hold ?? 0),
    other: round2(byChannel.other ?? 0),
  };
}

function item(key: string, label: string, amount: number): CutoffSummaryBreakdownItem {
  return { key, label, amount: round2(amount) };
}

function section(
  title: string,
  items: CutoffSummaryBreakdownItem[]
): CutoffSummaryBreakdownSection {
  return { title, items };
}

export function buildCutoffSummaryBreakdown(input: {
  lines: CutoffSummaryBreakdownLine[];
  fundingPeople?: FundingPerson[];
  periodEnd?: string;
  mainScrape?: { periodEnd: string; employees: ScrapedAccrual[] } | null;
  laterPostedBasics?: Array<{ name: string; basicPay: number }>;
}): CutoffSummaryBreakdown {
  const scrapeEmployees = input.mainScrape?.employees ?? [];
  const laterPosted = input.laterPostedBasics ?? [];
  const periodEnd = input.periodEnd ?? "";

  const auditRows = input.lines.map((line) => {
    const name = [line.last_name, line.first_name].filter(Boolean).join(", ");
    return organicRegisterLineToAuditRow(line, {
      registerPeriodEnd: periodEnd,
      scrapePeriodEnd: input.mainScrape?.periodEnd,
      scraped: name ? matchScrapedAccrual(name, scrapeEmployees) : null,
      laterCutoffBasics: name ? laterCutoffBasicsForName(name, laterPosted) : [],
    });
  });

  const categories = sumEmployeeCategories(auditRows);
  const thirteenthMonthYtd = round2(
    auditRows.reduce((acc, row) => acc + (row.thirteenthMonthYTD ?? 0), 0)
  );

  let sssLoan = 0;
  let sssCalamityLoan = 0;
  let pagibigLoan = 0;
  let pagibigCalamityLoan = 0;
  let pagibigMpl = 0;
  let pagibigSafe = 0;
  let companyLoan = 0;
  let emergencyLoan = 0;
  let loanOther = 0;
  let refundFromLoanCredits = 0;
  let employerSss = 0;
  let employerSssProvident = 0;
  let employerEcc = 0;
  let employerPagibig = 0;
  let employerPhilhealth = 0;

  for (const line of input.lines) {
    const loans = splitLoans(line);
    sssLoan += loans.sssLoan;
    sssCalamityLoan += loans.sssCalamityLoan;
    pagibigLoan += loans.pagibigLoan;
    pagibigCalamityLoan += loans.pagibigCalamityLoan;
    pagibigMpl += loans.pagibigMpl;
    pagibigSafe += loans.pagibigSafe;
    companyLoan += loans.companyLoan;
    emergencyLoan += loans.emergencyLoan;
    loanOther += loans.otherLoans;
    refundFromLoanCredits += loans.refundCredits;

    const er = employerShares(line);
    employerSss += er.sss;
    employerSssProvident += er.sssProvident;
    employerEcc += er.ecc;
    employerPagibig += er.pagibig;
    employerPhilhealth += er.philhealth;
  }

  const otherDeductionLump = round2(
    categories.otherDeduction + loanOther
  );
  const itemizedOther = aggregateOtherDeductionLinesByKey(input.lines);
  const itemizedTotal = sumOtherDeductionLines(itemizedOther);
  const residualOther = round2(Math.max(0, otherDeductionLump - itemizedTotal));

  const funding = fundingTotals(input.fundingPeople ?? []);

  const itemizedAllowances = aggregateAllowanceLinesByKey(input.lines);
  const standingInAllowColumn = itemizedAllowances
    .filter((row) => row.key !== "load_allowance")
    .reduce((sum, row) => round2(sum + row.amount), 0);
  // Load maps to its own audit column; residual is hour/COLA allowance still in Allow.
  const residualAllowance = round2(
    Math.max(0, categories.allowance - standingInAllowColumn)
  );

  const earningsItems: CutoffSummaryBreakdownItem[] = [
    item("salaries_and_wages", "Salaries and wages", categories.grossAmount),
    item(
      "refund",
      "Refund",
      round2(categories.refund + refundFromLoanCredits)
    ),
  ];
  if (itemizedAllowances.length) {
    for (const row of itemizedAllowances) {
      earningsItems.push(item(row.key, row.particular, row.amount));
    }
    if (residualAllowance > 0) {
      earningsItems.push(item("allowance", "Allowance", residualAllowance));
    }
  } else if (categories.allowance > 0) {
    earningsItems.push(item("allowance", "Allowance", categories.allowance));
  }
  earningsItems.push(
    item("cash_in_bank", "Cash in bank", funding.cashInBank),
    item("salary_credit", "Salary credit", funding.salaryCredit),
    item("gcash", "GCash", funding.gcash)
  );

  const deductionItems: CutoffSummaryBreakdownItem[] = [
    item("sss_loan", "SSS loan", sssLoan),
    item("sss_calamity_loan", "SSS calamity loan", sssCalamityLoan),
    item("pagibig_loan", "Pag-IBIG loan", pagibigLoan),
    item("pagibig_calamity_loan", "Pag-IBIG calamity loan", pagibigCalamityLoan),
  ];
  if (pagibigMpl > 0) {
    deductionItems.push(item("pagibig_mpl", "Pag-IBIG MPL", pagibigMpl));
  }
  if (pagibigSafe > 0) {
    deductionItems.push(item("pagibig_safe", "Pag-IBIG Safe loan", pagibigSafe));
  }
  if (companyLoan > 0) {
    deductionItems.push(item("company_loan", "Company loan", companyLoan));
  }
  if (emergencyLoan > 0) {
    deductionItems.push(item("emergency_loan", "Emergency loan", emergencyLoan));
  }
  deductionItems.push(
    item("sss", "SSS", categories.sss),
    item("pagibig", "Pag-IBIG", categories.pagibig),
    item("philhealth", "PhilHealth", categories.philhealth),
    item("wtax", "WTax payable", categories.withholdingTax),
    ...itemizedOther.map((row) => item(row.key, row.particular, row.amount))
  );
  if (residualOther > 0 || itemizedOther.length === 0) {
    deductionItems.push(
      item("other_deduction", "Other deduction", residualOther || otherDeductionLump)
    );
  }

  return {
    earnings: section("Earnings", earningsItems),
    deductions: section("Deductions", deductionItems),
    employeeShare: section("Employee share", [
      item("sss", "SSS", categories.sss),
      item("pagibig", "Pag-IBIG", categories.pagibig),
      item("philhealth", "PhilHealth", categories.philhealth),
    ]),
    employerShare: section("Employer share", [
      item("sss", "SSS", employerSss),
      item("sss_provident", "SSS provident", employerSssProvident),
      item("ecc", "ECC", employerEcc),
      item("pagibig", "Pag-IBIG", employerPagibig),
      item("philhealth", "PhilHealth", employerPhilhealth),
    ]),
    accruals13th: section("Accruals — 13th month", [
      item("cutoff", "Cutoff", categories.thirteenthMonthCutoff),
      item("ytd", "Year to date", thirteenthMonthYtd),
    ]),
    accrualsSil: section("Accruals — SIL", [
      item("cutoff", "Cutoff", categories.silCutoff),
    ]),
  };
}

/** Map register lines + Directory pay-through into funding people rows.
 * Line snapshot wins; Directory only fills blanks (legacy lines without freeze). */
export function fundingPeopleFromRegisterLines(
  lines: CutoffSummaryBreakdownLine[],
  payThroughByDir: Map<
    string,
    { pay_through?: string | null; bank_account_no?: string | null; gcash?: string | null }
  >
): FundingPerson[] {
  return lines.map((line) => {
    const dirId = String(line.directory_employee_id ?? "");
    const profile = payThroughByDir.get(dirId);
    // Once the line has a frozen channel, keep the whole payee trio (even null gcash).
    // Legacy lines without pay_through still fall through to Directory.
    const lineFrozen =
      line.pay_through != null && String(line.pay_through).trim() !== "";
    if (lineFrozen) {
      return {
        employee_code: null,
        last_name: line.last_name,
        first_name: line.first_name,
        net_pay: line.net_pay,
        pay_through: line.pay_through,
        bank_account_no: line.bank_account_no ?? null,
        gcash: line.gcash ?? null,
      };
    }
    return {
      employee_code: null,
      last_name: line.last_name,
      first_name: line.first_name,
      net_pay: line.net_pay,
      pay_through: profile?.pay_through ?? parseFundingPayThrough(null),
      bank_account_no:
        line.bank_account_no ?? profile?.bank_account_no ?? null,
      gcash: line.gcash ?? profile?.gcash ?? null,
    };
  });
}
