/**
 * Loans remittance report — GREENHRISMAIN SPlistofdeduction grain.
 * Sourced from posted register loan_lines (statutory products only by default).
 */

import XLSX from "xlsx-js-style";
import autoTable from "jspdf-autotable";
import { particularLabel } from "@/lib/loans/particular";
import {
  createGpLandscapeReport,
  stampGpReportFooter,
  gpReportTableBottomMargin,
  GP_REPORT_GREEN,
} from "@/lib/reports/gp-report-pdf";

export const LOANS_REPORT_TYPES = [
  "sss",
  "sss_calamity",
  "pagibig_mpl",
  "pagibig_calamity",
  "pagibig_safe",
] as const;

export type LoansReportType = (typeof LOANS_REPORT_TYPES)[number];

export const LOANS_REPORT_HEADERS = [
  "company_name",
  "department",
  "employee_code",
  "last_name",
  "first_name",
  "middle_name",
  "date_of_birth",
  "pagibig_no",
  "sss_no",
  "amount",
  "period_start",
  "period_end",
  "payout_date",
  "particular",
] as const;

export type LoansReportLoanLine = {
  loan_type?: string | null;
  particular?: string | null;
  amount?: number | null;
};

export type LoansReportSourceLine = {
  client_name?: string | null;
  department?: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  date_of_birth?: string | null;
  pagibig_no?: string | null;
  sss_no?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  payout_date?: string | null;
  loan_lines?: LoansReportLoanLine[] | null;
};

export type LoansReportRow = {
  company_name: string;
  department: string;
  employee_code: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  date_of_birth: string;
  pagibig_no: string;
  sss_no: string;
  amount: number;
  period_start: string;
  period_end: string;
  payout_date: string;
  particular: string;
  loan_type: string;
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Normalize stored loan_type for remittance matching (legacy pagibig → MPL). */
export function normalizeLoansReportType(
  loanType: string | null | undefined
): string {
  const key = text(loanType).toLowerCase();
  if (key === "pagibig") return "pagibig_mpl";
  return key;
}

export function loansReportMatchesType(
  loanType: string | null | undefined,
  filter: LoansReportType | null | undefined
): boolean {
  const normalized = normalizeLoansReportType(loanType);
  if (!normalized) return false;
  if (!filter) {
    return (LOANS_REPORT_TYPES as readonly string[]).includes(normalized);
  }
  if (filter === "pagibig_mpl") {
    return normalized === "pagibig_mpl";
  }
  return normalized === filter;
}

export function isLoansReportType(value: string): value is LoansReportType {
  return (LOANS_REPORT_TYPES as readonly string[]).includes(value);
}

export function explodeLoansReportRows(
  lines: LoansReportSourceLine[],
  opts: { loan_type?: LoansReportType | null } = {}
): LoansReportRow[] {
  const filter = opts.loan_type ?? null;
  const out: LoansReportRow[] = [];
  for (const line of lines) {
    for (const loan of line.loan_lines ?? []) {
      const amount = round2(n(loan.amount));
      // MAIN remittance includes negative adjustments; skip only exact zero.
      if (amount === 0) continue;
      const loanType = text(loan.loan_type);
      if (!loansReportMatchesType(loanType, filter)) continue;
      out.push({
        company_name: text(line.client_name),
        department: text(line.department),
        employee_code: text(line.employee_code),
        last_name: text(line.last_name),
        first_name: text(line.first_name),
        middle_name: text(line.middle_name),
        date_of_birth: text(line.date_of_birth),
        pagibig_no: text(line.pagibig_no),
        sss_no: text(line.sss_no),
        amount,
        period_start: text(line.period_start),
        period_end: text(line.period_end),
        payout_date: text(line.payout_date),
        particular: particularLabel(loanType, loan.particular),
        loan_type: normalizeLoansReportType(loanType) || loanType,
      });
    }
  }
  return out;
}

/** Cash advance = particular mentions cash advance (Organic house loans). */
export function isCashAdvanceLoanLine(
  loan: LoansReportLoanLine | null | undefined
): boolean {
  if (!loan) return false;
  const particular = text(loan.particular).toLowerCase();
  if (particular.includes("cash advance")) return true;
  // Default label for loan_type other when particular is blank.
  if (text(loan.loan_type).toLowerCase() === "other" && !particular) {
    return true;
  }
  return false;
}

export function explodeCashAdvanceReportRows(
  lines: LoansReportSourceLine[]
): LoansReportRow[] {
  const out: LoansReportRow[] = [];
  for (const line of lines) {
    for (const loan of line.loan_lines ?? []) {
      const amount = round2(n(loan.amount));
      if (amount === 0) continue;
      if (!isCashAdvanceLoanLine(loan)) continue;
      const loanType = text(loan.loan_type) || "other";
      out.push({
        company_name: text(line.client_name),
        department: text(line.department),
        employee_code: text(line.employee_code),
        last_name: text(line.last_name),
        first_name: text(line.first_name),
        middle_name: text(line.middle_name),
        date_of_birth: text(line.date_of_birth),
        pagibig_no: text(line.pagibig_no),
        sss_no: text(line.sss_no),
        amount,
        period_start: text(line.period_start),
        period_end: text(line.period_end),
        payout_date: text(line.payout_date),
        particular: particularLabel(loanType, loan.particular),
        loan_type: "other",
      });
    }
  }
  return out;
}

export function filterLoansReportRows(
  rows: LoansReportRow[],
  opts: { q?: string | null; client_name?: string | null } = {}
): LoansReportRow[] {
  let out = rows;
  const client = text(opts.client_name).toLowerCase();
  if (client) {
    out = out.filter((r) => r.company_name.toLowerCase() === client);
  }
  const q = text(opts.q).toLowerCase();
  if (q) {
    out = out.filter(
      (r) =>
        r.last_name.toLowerCase().includes(q) ||
        r.first_name.toLowerCase().includes(q) ||
        r.middle_name.toLowerCase().includes(q) ||
        r.employee_code.toLowerCase().includes(q) ||
        r.particular.toLowerCase().includes(q) ||
        r.company_name.toLowerCase().includes(q)
    );
  }
  return out;
}

export function paginateLoansReportRows(
  rows: LoansReportRow[],
  limit: number,
  offset: number
): LoansReportRow[] {
  const safeLimit = Math.min(Math.max(limit || 50, 1), 200);
  const safeOffset = Math.max(offset || 0, 0);
  return rows.slice(safeOffset, safeOffset + safeLimit);
}

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function loansReportRowValues(row: LoansReportRow): (string | number)[] {
  return LOANS_REPORT_HEADERS.map((key) => row[key]);
}

export function buildLoansReportCsv(rows: LoansReportRow[]): string {
  const lines = [
    LOANS_REPORT_HEADERS.join(","),
    ...rows.map((row) =>
      loansReportRowValues(row)
        .map((cell) => csvEscape(cell))
        .join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** MAIN "List of Other Deduction" remittance layout (loan PDF). */

const LOANS_REMITTANCE_TYPE_LABELS: Record<string, string> = {
  sss: "SSS Loan",
  sss_calamity: "SSS Calamity Loan",
  pagibig_mpl: "Pag-IBIG Loan",
  pagibig: "Pag-IBIG Loan",
  pagibig_calamity: "Pag-IBIG Calamity Loan",
  pagibig_safe: "Pag-IBIG Safe Loan",
};

export function formatLoansRemittanceDate(value: string | null | undefined): string {
  const raw = text(value);
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return raw;
}

export function formatLoansRemittanceCutoff(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined
): string {
  const from = formatLoansRemittanceDate(periodStart);
  const to = formatLoansRemittanceDate(periodEnd);
  if (!from && !to) return "";
  if (!from) return to;
  if (!to) return from;
  return `${from} to ${to}`;
}

export function formatLoansRemittanceEmployeeName(row: {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
}): string {
  const last = text(row.last_name).toUpperCase();
  const first = text(row.first_name).toUpperCase();
  const mid = text(row.middle_name).toUpperCase();
  if (!last && !first) return "";
  if (!last) return mid ? `${first} ${mid}` : first;
  if (!first) return last;
  return mid ? `${last}, ${first} ${mid}` : `${last}, ${first}`;
}

export function loansRemittanceTitle(
  particularOrType: string | null | undefined
): string {
  const raw = text(particularOrType);
  if (!raw) return "List of Other Deduction";
  const label =
    LOANS_REMITTANCE_TYPE_LABELS[raw.toLowerCase()] ??
    (raw.includes(" ") ? raw : particularLabel(raw, raw));
  return `List of Other Deduction(${label})`;
}

export type LoansRemittanceNumberedRow = LoansReportRow & { row_no: number };

export type LoansRemittanceCompanyGroup = {
  company_name: string;
  rows: LoansRemittanceNumberedRow[];
  total: number;
};

export function groupLoansReportByCompany(rows: LoansReportRow[]): {
  groups: LoansRemittanceCompanyGroup[];
  grand_total: number;
} {
  const sorted = [...rows].sort((a, b) => {
    const company = a.company_name.localeCompare(b.company_name);
    if (company !== 0) return company;
    const name = formatLoansRemittanceEmployeeName(a).localeCompare(
      formatLoansRemittanceEmployeeName(b)
    );
    if (name !== 0) return name;
    return a.period_start.localeCompare(b.period_start);
  });
  const groups: LoansRemittanceCompanyGroup[] = [];
  let grand = 0;
  for (const row of sorted) {
    const company = row.company_name || "—";
    let group = groups[groups.length - 1];
    if (!group || group.company_name !== company) {
      group = { company_name: company, rows: [], total: 0 };
      groups.push(group);
    }
    group.rows.push({ ...row, row_no: group.rows.length + 1 });
    group.total = round2(group.total + row.amount);
    grand = round2(grand + row.amount);
  }
  return { groups, grand_total: grand };
}

export const LOANS_REMITTANCE_CSV_HEADERS = [
  "#",
  "Employee Name",
  "Birth Date",
  "Company Name",
  "Department/Group",
  "Payout Date",
  "Cutoff",
  "Particular",
  "Amount",
  "SSS Number",
] as const;

export function buildLoansRemittanceCsv(
  rows: LoansReportRow[],
  opts: {
    dateFrom?: string | null;
    dateTo?: string | null;
    particular?: string | null;
  } = {}
): string {
  const particular =
    text(opts.particular) ||
    (rows[0]?.particular ? rows[0].particular : "SSS Loan");
  const { groups, grand_total } = groupLoansReportByCompany(rows);
  const lines: string[] = [
    loansRemittanceTitle(particular),
    `Payout Date: ${formatLoansRemittanceDate(opts.dateFrom) || "—"} to ${
      formatLoansRemittanceDate(opts.dateTo) || "—"
    }`,
    "",
    LOANS_REMITTANCE_CSV_HEADERS.join(","),
  ];
  for (const group of groups) {
    lines.push(csvEscape(group.company_name));
    for (const row of group.rows) {
      lines.push(
        [
          row.row_no,
          formatLoansRemittanceEmployeeName(row),
          formatLoansRemittanceDate(row.date_of_birth),
          row.company_name,
          row.department,
          formatLoansRemittanceDate(row.payout_date),
          formatLoansRemittanceCutoff(row.period_start, row.period_end),
          row.particular,
          row.amount,
          row.sss_no,
        ]
          .map((cell) => csvEscape(cell))
          .join(",")
      );
    }
    lines.push(`Total:,${csvEscape(group.total)}`);
  }
  lines.push(`Grand Total:,${csvEscape(grand_total)}`);
  return `${lines.join("\n")}\n`;
}

export function loansReportFilename(opts: {
  dateFrom?: string | null;
  dateTo?: string | null;
  loanType?: string | null;
}): string {
  const from = text(opts.dateFrom) || "all";
  const to = text(opts.dateTo) || "all";
  const type = text(opts.loanType) || "statutory";
  return `loans-report-${type}-${from}-${to}`;
}

export function cashAdvanceReportFilename(opts: {
  dateFrom?: string | null;
  dateTo?: string | null;
}): string {
  const from = text(opts.dateFrom) || "all";
  const to = text(opts.dateTo) || "all";
  return `cash-advance-report-${from}-${to}`;
}

export type LoansRemittanceExportInput = {
  rows: LoansReportRow[];
  dateFrom?: string | null;
  dateTo?: string | null;
  particular?: string | null;
  title?: string | null;
  logoDataUrl?: string | null;
};

export function buildLoansRemittanceWorkbook(
  input: LoansRemittanceExportInput
): Buffer {
  const particular =
    text(input.particular) ||
    (input.rows[0]?.particular ? input.rows[0].particular : "SSS Loan");
  const title = text(input.title) || loansRemittanceTitle(particular);
  const { groups, grand_total } = groupLoansReportByCompany(input.rows);
  const aoa: unknown[][] = [
    [title],
    [
      `Payout Date: ${formatLoansRemittanceDate(input.dateFrom) || "—"} to ${
        formatLoansRemittanceDate(input.dateTo) || "—"
      }`,
    ],
    [],
    [...LOANS_REMITTANCE_CSV_HEADERS],
  ];
  for (const group of groups) {
    aoa.push([group.company_name]);
    for (const row of group.rows) {
      aoa.push([
        row.row_no,
        formatLoansRemittanceEmployeeName(row),
        formatLoansRemittanceDate(row.date_of_birth),
        row.company_name,
        row.department,
        formatLoansRemittanceDate(row.payout_date),
        formatLoansRemittanceCutoff(row.period_start, row.period_end),
        row.particular,
        row.amount,
        row.sss_no,
      ]);
    }
    aoa.push(["Total:", "", "", "", "", "", "", "", group.total, ""]);
  }
  aoa.push(["Grand Total:", "", "", "", "", "", "", "", grand_total, ""]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Remittance");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildLoansRemittancePdf(
  input: LoansRemittanceExportInput
): Buffer {
  const particular =
    text(input.particular) ||
    (input.rows[0]?.particular ? input.rows[0].particular : "SSS Loan");
  const title = text(input.title) || loansRemittanceTitle(particular);
  const { groups, grand_total } = groupLoansReportByCompany(input.rows);
  const { doc, contentTop, margin } = createGpLandscapeReport({
    title,
    subtitle: `Payout Date: ${
      formatLoansRemittanceDate(input.dateFrom) || "—"
    } to ${formatLoansRemittanceDate(input.dateTo) || "—"}`,
    logoDataUrl: input.logoDataUrl ?? null,
  });

  const money = (v: number) =>
    v.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const body: string[][] = [];
  for (const group of groups) {
    body.push([group.company_name, "", "", "", "", "", "", "", "", ""]);
    for (const row of group.rows) {
      body.push([
        String(row.row_no),
        formatLoansRemittanceEmployeeName(row),
        formatLoansRemittanceDate(row.date_of_birth),
        row.company_name,
        row.department,
        formatLoansRemittanceDate(row.payout_date),
        formatLoansRemittanceCutoff(row.period_start, row.period_end),
        row.particular,
        money(row.amount),
        row.sss_no,
      ]);
    }
    body.push(["", "", "", "", "", "", "", "Total:", money(group.total), ""]);
  }
  body.push(["", "", "", "", "", "", "", "Grand Total:", money(grand_total), ""]);

  autoTable(doc, {
    startY: contentTop,
    head: [[...LOANS_REMITTANCE_CSV_HEADERS]],
    body,
    margin: {
      left: margin,
      right: margin,
      top: margin,
      bottom: gpReportTableBottomMargin(margin),
    },
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
    },
    columnStyles: {
      8: { halign: "right" },
    },
  });

  stampGpReportFooter(doc, margin);
  return Buffer.from(doc.output("arraybuffer"));
}
