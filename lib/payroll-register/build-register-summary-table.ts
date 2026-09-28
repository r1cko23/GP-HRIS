/**
 * Build a printable payroll summary table from Organic register lines.
 * Columns match payroll-audit `PAYROLL_REGISTER_HEADERS` so hours, OT,
 * holiday, SIL, and loans project the same way as parsed MAIN summaries.
 * When itemized lines exist:
 * - Allow. expands into TL / Superv. (+ residual Allow.)
 * - Load standing maps to the Load column
 * - Other Ded. expands into PA / BDO Ins. / HMO / …
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
import {
  ALLOWANCE_PDF_LABELS,
  allowanceAmountForKey,
  type AllowanceKey,
  type AllowanceLine,
} from "./allowance-lines";
import {
  OTHER_DEDUCTION_PDF_LABELS,
  otherDeductionAmountForKey,
  presentOtherDeductionKeys,
  sumOtherDeductionLines,
  type OtherDeductionLine,
} from "./other-deduction-lines";

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
  other_deduction_lines?: OtherDeductionLine[] | null;
  allowance_lines?: AllowanceLine[] | null;
};

const NUMERIC_FIELDS = Object.keys(GP_HRIS_REGISTER_COL) as Array<
  keyof typeof GP_HRIS_REGISTER_COL
>;

const OTHER_DED_HEADER = "Other Ded.";
const ALLOW_HEADER = "Allow.";

/** Standing allowances that expand the Allow. column (Load uses the Load column). */
const ALLOW_EXPAND_KEYS: AllowanceKey[] = [
  "tl_allowance",
  "supervisory_allowance",
];

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

function residualOtherDeduction(
  line: RegisterSummaryLine,
  auditOther: number
): number {
  const itemized = sumOtherDeductionLines(line.other_deduction_lines);
  return Math.round(Math.max(0, auditOther - itemized) * 100) / 100;
}

function expandNamedColumn(
  headers: string[],
  cells: (string | number)[],
  widths: number[],
  headerName: string,
  insertedHeaders: string[],
  insertedAmounts: number[],
  residual: number,
  keepResidual: boolean,
  residualHeader: string
): { headers: string[]; cells: (string | number)[]; widths: number[] } {
  const idx = headers.indexOf(headerName);
  if (idx < 0 || !insertedHeaders.length) {
    return { headers, cells, widths };
  }
  return {
    headers: [
      ...headers.slice(0, idx),
      ...insertedHeaders,
      ...(keepResidual ? [residualHeader] : []),
      ...headers.slice(idx + 1),
    ],
    cells: [
      ...cells.slice(0, idx),
      ...insertedAmounts,
      ...(keepResidual ? [residual] : []),
      ...cells.slice(idx + 1),
    ],
    widths: [
      ...widths.slice(0, idx),
      ...insertedHeaders.map(() => 10),
      ...(keepResidual ? [11] : []),
      ...widths.slice(idx + 1),
    ],
  };
}

function presentAllowExpandKeys(lines: RegisterSummaryLine[]): AllowanceKey[] {
  return ALLOW_EXPAND_KEYS.filter((key) =>
    lines.some((line) => allowanceAmountForKey(line.allowance_lines, key) > 0)
  );
}

function residualAllowAmount(
  line: RegisterSummaryLine,
  auditAllow: number,
  keys: AllowanceKey[]
): number {
  const itemized = keys.reduce(
    (sum, key) => sum + allowanceAmountForKey(line.allowance_lines, key),
    0
  );
  return Math.round(Math.max(0, auditAllow - itemized) * 100) / 100;
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
  /** Override document title (default Payroll Summary). */
  title?: string;
}): GpPayrollRegisterTable {
  const siteBits = [params.companyName, params.branchName]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const title = params.title?.trim() || "Payroll Summary";
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

  let headers: string[] = [...PAYROLL_REGISTER_PDF_HEADERS];
  let columnWidths = [
    32, 11, 9, 8, 12, 12, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 11, 10, 10, 10,
    10, 10, 12, 10, 10, 11, 11, 10, 11, 11, 12, 12, 11, 10, 11,
  ];
  let rows = auditRows.map((row) => cellsFromAuditRow(row));
  let totalsRow = cellsFromAuditRow(totals, { total: true });

  const allowKeys = presentAllowExpandKeys(params.lines);
  if (allowKeys.length) {
    const residualByLine = params.lines.map((line, i) =>
      residualAllowAmount(line, auditRows[i]?.allowance ?? 0, allowKeys)
    );
    const residualTotal = residualByLine.reduce((s, v) => s + v, 0);
    const keepResidual = Math.round(residualTotal * 100) / 100 > 0;
    const insertedHeaders = allowKeys.map((key) => ALLOWANCE_PDF_LABELS[key]);
    const totalAmounts = allowKeys.map(
      (key) =>
        Math.round(
          params.lines.reduce(
            (sum, line) =>
              sum + allowanceAmountForKey(line.allowance_lines, key),
            0
          ) * 100
        ) / 100
    );

    const headerPass = expandNamedColumn(
      headers,
      totalsRow,
      columnWidths,
      ALLOW_HEADER,
      insertedHeaders,
      totalAmounts,
      Math.round(residualTotal * 100) / 100,
      keepResidual,
      ALLOW_HEADER
    );
    rows = params.lines.map((line, i) =>
      expandNamedColumn(
        headers,
        rows[i]!,
        columnWidths,
        ALLOW_HEADER,
        insertedHeaders,
        allowKeys.map((key) =>
          allowanceAmountForKey(line.allowance_lines, key)
        ),
        residualByLine[i] ?? 0,
        keepResidual,
        ALLOW_HEADER
      ).cells
    );
    headers = headerPass.headers;
    columnWidths = headerPass.widths;
    totalsRow = headerPass.cells;
  }

  const otherKeys = presentOtherDeductionKeys(params.lines);
  if (otherKeys.length) {
    const residualByLine = params.lines.map((line, i) =>
      residualOtherDeduction(line, auditRows[i]?.otherDeduction ?? 0)
    );
    const residualTotal = residualByLine.reduce((s, v) => s + v, 0);
    const keepResidual = Math.round(residualTotal * 100) / 100 > 0;
    const insertedHeaders = otherKeys.map(
      (key) => OTHER_DEDUCTION_PDF_LABELS[key]
    );
    const totalAmounts = otherKeys.map(
      (key) =>
        Math.round(
          params.lines.reduce(
            (sum, line) =>
              sum + otherDeductionAmountForKey(line.other_deduction_lines, key),
            0
          ) * 100
        ) / 100
    );

    const headerPass = expandNamedColumn(
      headers,
      totalsRow,
      columnWidths,
      OTHER_DED_HEADER,
      insertedHeaders,
      totalAmounts,
      Math.round(residualTotal * 100) / 100,
      keepResidual,
      OTHER_DED_HEADER
    );
    rows = params.lines.map((line, i) =>
      expandNamedColumn(
        headers,
        rows[i]!,
        columnWidths,
        OTHER_DED_HEADER,
        insertedHeaders,
        otherKeys.map((key) =>
          otherDeductionAmountForKey(line.other_deduction_lines, key)
        ),
        residualByLine[i] ?? 0,
        keepResidual,
        OTHER_DED_HEADER
      ).cells
    );
    headers = headerPass.headers;
    columnWidths = headerPass.widths;
    totalsRow = headerPass.cells;
  }

  return {
    title,
    subtitle,
    headers,
    rows,
    totalsRow,
    columnWidths,
  };
}
