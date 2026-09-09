/**
 * Stamp 13th-month cutoff, SIL cutoff, and 13th YTD onto a GP summary row.
 * YTD January–last MAIN scrape comes from payroll-audit uploads (catalog).
 * Later GP kinsenas add basic/12. Never EXEC GREENHRISMAIN (ADR 0009).
 */

import {
  employeeNameSimilarity,
  RENAME_MATCH_THRESHOLD,
} from "@/lib/payroll-summary/employee-name-match";
import { silCutoffAccrual } from "@/lib/reports/sil-cutoff-accrual";
import { thirteenthMonthAccrual } from "@/lib/reports/thirteenth-month";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPANY_STOP = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "ltd",
  "llc",
  "co",
  "the",
  "and",
  "of",
  "food",
  "philippines",
  "philippine",
  "edd",
]);

export type ScrapedAccrual = {
  name: string;
  thirteenthMonthCutoff: number;
  thirteenthMonthYTD: number;
  silCutoff: number;
};

export type MainAccrualOverlay = {
  thirteenthMonthCutoff: number;
  silCutoff: number;
  thirteenthMonthYTD: number;
};

export type OrganicAccrualContext = {
  scrapePeriodEnd?: string | null;
  registerPeriodEnd?: string | null;
  scraped?: ScrapedAccrual | null;
  laterCutoffBasics?: number[];
};

export type MainScrapeUpload = {
  companyName: string;
  periodEnd: string;
  employees: ScrapedAccrual[];
};

export function samePayrollPerson(a: string, b: string): boolean {
  return employeeNameSimilarity(a, b) >= RENAME_MATCH_THRESHOLD;
}

export function siteMatchesAuditCompany(
  clientName: string,
  branchName: string | null | undefined,
  companyName: string
): boolean {
  const companyTokens = new Set(fold(companyName).split(" ").filter(Boolean));
  if (companyTokens.size === 0) return false;

  const branchTokens = fold(branchName ?? "")
    .split(" ")
    .filter((token) => token.length >= 3);
  if (branchTokens.length === 0) return false;
  if (branchTokens.some((token) => !companyTokens.has(token))) {
    return false;
  }

  const clientTokens = fold(clientName)
    .split(" ")
    .filter((token) => token.length >= 4 && !COMPANY_STOP.has(token));
  if (clientTokens.length === 0) return branchTokens.length > 0;
  return clientTokens.some((token) => companyTokens.has(token));
}

export function scrapedAccrualsFromParsedEmployees(
  employees: Array<Record<string, unknown>>
): ScrapedAccrual[] {
  return employees.map((row) => ({
    name: String(row.name ?? "").trim(),
    thirteenthMonthCutoff: n(row.thirteenthMonthCutoff),
    thirteenthMonthYTD: n(row.thirteenthMonthYTD),
    silCutoff: n(row.silCutoff),
  }));
}

export function selectLatestMainScrape(
  uploads: MainScrapeUpload[],
  opts: {
    clientName: string;
    branchName: string | null | undefined;
    onOrBefore: string;
  }
): MainScrapeUpload | null {
  const onOrBefore = opts.onOrBefore.slice(0, 10);
  const matching = uploads.filter(
    (upload) =>
      upload.periodEnd.slice(0, 10) <= onOrBefore &&
      siteMatchesAuditCompany(opts.clientName, opts.branchName, upload.companyName)
  );
  if (!matching.length) return null;
  return matching.reduce((latest, upload) =>
    upload.periodEnd.slice(0, 10) > latest.periodEnd.slice(0, 10) ? upload : latest
  );
}

export function matchScrapedAccrual(
  registerName: string,
  employees: ScrapedAccrual[]
): ScrapedAccrual | null {
  let best: ScrapedAccrual | null = null;
  let bestScore = 0;
  for (const employee of employees) {
    const score = employeeNameSimilarity(registerName, employee.name);
    if (score >= RENAME_MATCH_THRESHOLD && score > bestScore) {
      best = employee;
      bestScore = score;
    }
  }
  return best;
}

export function overlayMainAccruals(input: {
  basicPay: number;
  daysWorked: number;
  dailyRate: number;
  registerPeriodEnd: string;
  scrapePeriodEnd?: string | null;
  scraped: ScrapedAccrual | null;
  laterCutoffBasics: number[];
}): MainAccrualOverlay {
  const thirteenthMonthCutoff = thirteenthMonthAccrual(input.basicPay);
  const silCutoff = silCutoffAccrual(input.daysWorked, input.dailyRate);
  if (!input.scraped) {
    return {
      thirteenthMonthCutoff,
      silCutoff,
      thirteenthMonthYTD: thirteenthMonthCutoff,
    };
  }

  const scrapeEnd = (input.scrapePeriodEnd ?? "").slice(0, 10);
  const registerEnd = input.registerPeriodEnd.slice(0, 10);
  if (scrapeEnd && scrapeEnd >= registerEnd) {
    return {
      thirteenthMonthCutoff,
      silCutoff,
      thirteenthMonthYTD: n(input.scraped.thirteenthMonthYTD),
    };
  }

  const later = (input.laterCutoffBasics ?? []).reduce(
    (sum, basic) => sum + thirteenthMonthAccrual(basic),
    0
  );
  return {
    thirteenthMonthCutoff,
    silCutoff,
    thirteenthMonthYTD: round2(
      n(input.scraped.thirteenthMonthYTD) + later + thirteenthMonthCutoff
    ),
  };
}

export function laterCutoffBasicsForName(
  registerName: string,
  laterPosted: Array<{ name: string; basicPay: number }>
): number[] {
  return laterPosted
    .filter((row) => samePayrollPerson(registerName, row.name))
    .map((row) => row.basicPay);
}
