/**
 * Grouped payroll summary totals — mirrors MAIN Payroll Summary footer sections
 * (Earnings, Deductions, Employee/Employer share, Accruals) for cutoff hub UI.
 */

import { getCutoffStatutoryDeductions } from "@/lib/ph-payroll/statutory-cutoff";
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
    amount?: number | null;
  }> | null;
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
  pagibigLoan: number;
  otherLoans: number;
};

function splitLoans(line: CutoffSummaryBreakdownLine): LoanSplit {
  const loanLines = line.loan_lines ?? [];
  if (!loanLines.length) {
    return { sssLoan: 0, pagibigLoan: 0, otherLoans: n(line.deductions?.loans) };
  }

  let sssLoan = 0;
  let pagibigLoan = 0;
  let otherLoans = 0;
  for (const row of loanLines) {
    const amount = n(row.amount);
    if (amount <= 0) continue;
    const type = String(row.loan_type ?? "").toLowerCase();
    if (type === "sss") sssLoan += amount;
    else if (type === "pagibig") pagibigLoan += amount;
    else otherLoans += amount;
  }
  return {
    sssLoan: round2(sssLoan),
    pagibigLoan: round2(pagibigLoan),
    otherLoans: round2(otherLoans),
  };
}

function employerShares(line: CutoffSummaryBreakdownLine) {
  const deductions = (line.deductions ?? {}) as Record<string, unknown>;
  const monthlySalary = n(line.monthly_salary);
  const computed =
    monthlySalary > 0
      ? getCutoffStatutoryDeductions(monthlySalary)
      : getCutoffStatutoryDeductions(0);

  return {
    sss: pickStored(deductions, "sss_er", computed.sss_er),
    sssProvident: pickStored(deductions, "sss_wisp_er", computed.sss_wisp_er),
    ecc: pickStored(deductions, "sss_ecc", computed.sss_ecc),
    pagibig: pickStored(deductions, "pagibig_er", computed.pagibig_er),
    philhealth: pickStored(deductions, "philhealth_er", computed.philhealth_er),
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
  let pagibigLoan = 0;
  let loanOther = 0;
  let employerSss = 0;
  let employerSssProvident = 0;
  let employerEcc = 0;
  let employerPagibig = 0;
  let employerPhilhealth = 0;

  for (const line of input.lines) {
    const loans = splitLoans(line);
    sssLoan += loans.sssLoan;
    pagibigLoan += loans.pagibigLoan;
    loanOther += loans.otherLoans;

    const er = employerShares(line);
    employerSss += er.sss;
    employerSssProvident += er.sssProvident;
    employerEcc += er.ecc;
    employerPagibig += er.pagibig;
    employerPhilhealth += er.philhealth;
  }

  const otherDeduction = round2(
    categories.otherDeduction + loanOther
  );

  const funding = fundingTotals(input.fundingPeople ?? []);

  return {
    earnings: section("Earnings", [
      item("salaries_and_wages", "Salaries and wages", categories.grossAmount),
      item("cash_in_bank", "Cash in bank", funding.cashInBank),
      item("salary_credit", "Salary credit", funding.salaryCredit),
      item("gcash", "GCash", funding.gcash),
    ]),
    deductions: section("Deductions", [
      item("sss_loan", "SSS loan", sssLoan),
      item("pagibig_loan", "Pag-IBIG loan", pagibigLoan),
      item("sss", "SSS", categories.sss),
      item("pagibig", "Pag-IBIG", categories.pagibig),
      item("philhealth", "PhilHealth", categories.philhealth),
      item("wtax", "WTax payable", categories.withholdingTax),
      item("other_deduction", "Other deduction", otherDeduction),
    ]),
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

/** Map register lines + Directory pay-through into funding people rows. */
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
    return {
      employee_code: null,
      last_name: line.last_name,
      first_name: line.first_name,
      net_pay: line.net_pay,
      pay_through: profile?.pay_through ?? parseFundingPayThrough(null),
      bank_account_no: profile?.bank_account_no ?? null,
      gcash: profile?.gcash ?? null,
    };
  });
}
