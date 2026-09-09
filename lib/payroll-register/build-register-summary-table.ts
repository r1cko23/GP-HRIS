/**
 * Build a printable payroll summary table from Organic register lines.
 * Columns match payroll-audit `PAYROLL_REGISTER_HEADERS` so hours, OT,
 * holiday, SIL, and loans project the same way as parsed MAIN summaries.
 */

import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
import {
  emptyRegisterRow,
  GP_HRIS_REGISTER_COL,
  PAYROLL_REGISTER_PDF_HEADERS,
  type PayrollRegisterRow,
} from "@/lib/payroll-summary/register-columns";
import {
  laterCutoffBasicsForName,
  matchScrapedAccrual,
  type ScrapedAccrual,
} from "./main-accrual-overlay";
import { organicRegisterLineToAuditRow } from "./organic-register-to-audit-row";

export type RegisterSummaryLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  daily_rate?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  hours?: Record<string, number> | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
};

const NUMERIC_FIELDS = Object.keys(GP_HRIS_REGISTER_COL) as Array<
  keyof typeof GP_HRIS_REGISTER_COL
>;

function slashDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

function cellsFromAuditRow(
  row: PayrollRegisterRow,
  opts?: { total?: boolean }
): (string | number)[] {
  const nums = NUMERIC_FIELDS.map((field) => row[field] ?? 0);
  if (opts?.total) {
    return ["TOTAL", "", ...nums.slice(1)];
  }
  return [row.name, ...nums];
}

function addRows(a: PayrollRegisterRow, b: PayrollRegisterRow): PayrollRegisterRow {
  const sum = emptyRegisterRow("TOTAL");
  for (const field of NUMERIC_FIELDS) {
    sum[field] = (a[field] ?? 0) + (b[field] ?? 0);
  }
  return sum;
}

export function buildOrganicRegisterSummaryTable(params: {
  periodStart: string;
  periodEnd: string;
  /** Client / site label under the company chrome (not a second company name). */
  companyName?: string;
  branchName?: string | null;
  lines: RegisterSummaryLine[];
  mainScrape?: { periodEnd: string; employees: ScrapedAccrual[] } | null;
  laterPostedBasics?: Array<{ name: string; basicPay: number }>;
}): GpPayrollRegisterTable {
  const siteBits = [params.companyName, params.branchName]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const title = "Payroll Summary";
  const periodLabel = formatBiMonthlyPeriod(
    new Date(params.periodStart),
    new Date(params.periodEnd)
  );
  const subtitle = [
    siteBits.length ? siteBits.join(" · ") : null,
    periodLabel,
    `Cutoff ${slashDate(params.periodStart)} – ${slashDate(params.periodEnd)}`,
    `Generated ${format(new Date(), "MMM d, yyyy")}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const laterPosted = params.laterPostedBasics ?? [];
  const scrapeEmployees = params.mainScrape?.employees ?? [];
  const auditRows = params.lines.map((line) => {
    const name = [line.last_name, line.first_name].filter(Boolean).join(", ");
    return organicRegisterLineToAuditRow(line, {
      registerPeriodEnd: params.periodEnd,
      scrapePeriodEnd: params.mainScrape?.periodEnd,
      scraped: name ? matchScrapedAccrual(name, scrapeEmployees) : null,
      laterCutoffBasics: name ? laterCutoffBasicsForName(name, laterPosted) : [],
    });
  });
  const totals = auditRows.reduce(
    (acc, row) => addRows(acc, row),
    emptyRegisterRow("TOTAL")
  );

  return {
    title,
    subtitle,
    headers: [...PAYROLL_REGISTER_PDF_HEADERS],
    rows: auditRows.map((row) => cellsFromAuditRow(row)),
    totalsRow: cellsFromAuditRow(totals, { total: true }),
    columnWidths: [
      32, 11, 9, 8, 12, 12, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 11, 10, 10, 10,
      10, 10, 12, 10, 10, 11, 11, 10, 11, 11, 12, 12, 11, 10, 11,
    ],
  };
}
