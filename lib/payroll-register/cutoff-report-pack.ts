/**
 * Organic cutoff report pack — file contents Finance needs per GREENHRISMAIN
 * (WTAX with TIN, ATM bank, other-deduction particulars, SSS/PH/Pag-IBIG EE+ER).
 * Do not EXEC legacy procs; this ports columns.
 */

import { particularLabel } from "@/lib/loans/particular";
import type { StatutoryThisCutoff } from "@/lib/ph-payroll/statutory-schedule";

export type CutoffExportType =
  | "sss"
  | "philhealth"
  | "pagibig"
  | "wtax"
  | "bank"
  | "other_deductions"
  | "payslips"
  | "register_detail";

export const MONTHLY_REMITTANCE_TYPES = [
  "sss",
  "philhealth",
  "pagibig",
] as const;

export type MonthlyRemittanceType = (typeof MONTHLY_REMITTANCE_TYPES)[number];

export type PackDirectoryIds = {
  tin?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
};

export type PackRegisterLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  directory_employee_id?: string | null;
  daily_rate?: number | null;
  gross_pay?: number | null;
  net_pay?: number | null;
  total_deductions?: number | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  loan_lines?: Array<{
    loan_type?: string | null;
    particular?: string | null;
    amount?: number | null;
  }> | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
};

export type ClientSupplementalFlags = {
  include_cola: boolean;
  include_sea: boolean;
  include_ctpa: boolean;
};

function earn(line: PackRegisterLine, key: string): number {
  return n(line.earnings?.[key]);
}

export type CsvPack = {
  headers: string[];
  rows: Array<Array<unknown>>;
  filename: string;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function deduct(line: PackRegisterLine): Record<string, number> {
  return line.deductions ?? {};
}

function idsFor(
  line: PackRegisterLine,
  byDir: Map<string, PackDirectoryIds>
): PackDirectoryIds {
  const dirId = line.directory_employee_id;
  return (dirId ? byDir.get(dirId) : undefined) ?? {};
}

function atmNo(line: PackRegisterLine, ids: PackDirectoryIds): string {
  return text(ids.bank_account_no) || text(line.bank_account_no);
}

export function isMonthlyRemittanceType(
  type: string
): type is MonthlyRemittanceType {
  return (MONTHLY_REMITTANCE_TYPES as readonly string[]).includes(type);
}

export function monthlyRemittanceHeld(
  flags: StatutoryThisCutoff,
  type: MonthlyRemittanceType
): boolean {
  if (type === "sss") return !flags.sss;
  if (type === "philhealth") return !flags.philhealth;
  return !flags.pagibig;
}

export function monthlyRemittanceHeldMessage(
  type: MonthlyRemittanceType
): string {
  const label =
    type === "sss" ? "SSS" : type === "philhealth" ? "PhilHealth" : "Pag-IBIG";
  return `${label} remittance is filed on the second kinsena for this Client (Monthly statutory).`;
}

export function remittanceFilesThisCutoff(flags: StatutoryThisCutoff): {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  wtax: boolean;
  bank: boolean;
  other_deductions: boolean;
  register_detail: boolean;
} {
  return {
    sss: flags.sss,
    philhealth: flags.philhealth,
    pagibig: flags.pagibig,
    wtax: flags.wtax,
    bank: true,
    other_deductions: true,
    register_detail: true,
  };
}

export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    headers.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

export function buildWtaxCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `wtax-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "tin",
      "withholding_tax",
      "taxable_income",
      "gross_pay",
    ],
    rows: lines.map((line) => {
      const d = deduct(line);
      const ids = idsFor(line, byDir);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        text(ids.tin),
        n(d.withholding_tax),
        n(d.taxable_income) || n(line.gross_pay),
        n(line.gross_pay),
      ];
    }),
  };
}

export function buildSssCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `sss-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "sss_no",
      "sss_ee",
      "sss_er",
      "sss_ecc",
      "sss_wisp_ee",
      "sss_wisp_er",
      "gross_pay",
    ],
    rows: lines.map((line) => {
      const d = deduct(line);
      const ids = idsFor(line, byDir);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        text(ids.sss_number),
        n(d.sss),
        n(d.sss_er),
        n(d.sss_ecc),
        n(d.sss_wisp),
        n(d.sss_wisp_er),
        n(line.gross_pay),
      ];
    }),
  };
}

export function buildPhilhealthCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `philhealth-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "philhealth_no",
      "philhealth_ee",
      "philhealth_er",
      "gross_pay",
    ],
    rows: lines.map((line) => {
      const d = deduct(line);
      const ids = idsFor(line, byDir);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        text(ids.philhealth_number),
        n(d.philhealth),
        n(d.philhealth_er),
        n(line.gross_pay),
      ];
    }),
  };
}

export function buildPagibigCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `pagibig-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "pagibig_no",
      "pagibig_ee",
      "pagibig_er",
      "gross_pay",
    ],
    rows: lines.map((line) => {
      const d = deduct(line);
      const ids = idsFor(line, byDir);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        text(ids.pagibig_number),
        n(d.pagibig),
        n(d.pagibig_er),
        n(line.gross_pay),
      ];
    }),
  };
}

export function buildBankCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `atm-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "pay_type",
      "atm_no",
      "bank_name",
      "net_pay",
    ],
    rows: lines.map((line) => {
      const ids = idsFor(line, byDir);
      const atm = atmNo(line, ids);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        atm ? "ATM" : "UNSET",
        atm,
        text(ids.bank_name) || text(line.bank_name),
        n(line.net_pay),
      ];
    }),
  };
}

export function buildOtherDeductionRows(
  lines: PackRegisterLine[]
): Array<{
  directory_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  particular: string;
  amount: number;
}> {
  const out: Array<{
    directory_employee_id: string | null;
    employee_code: string | null;
    last_name: string | null;
    first_name: string | null;
    particular: string;
    amount: number;
  }> = [];
  for (const line of lines) {
    const d = deduct(line);
    const person = {
      directory_employee_id: line.directory_employee_id ?? null,
      employee_code: line.employee_code ?? null,
      last_name: line.last_name ?? null,
      first_name: line.first_name ?? null,
    };
    let loanSum = 0;
    for (const loan of line.loan_lines ?? []) {
      const amount = n(loan.amount);
      if (amount <= 0) continue;
      loanSum = Math.round((loanSum + amount) * 100) / 100;
      out.push({
        ...person,
        particular: particularLabel(loan.loan_type, loan.particular),
        amount,
      });
    }
    const leftoverLoans = Math.round((n(d.loans) - loanSum) * 100) / 100;
    if (leftoverLoans > 0) {
      out.push({ ...person, particular: "Loans", amount: leftoverLoans });
    }
    const other = n(d.other);
    if (other > 0) {
      out.push({ ...person, particular: "Other Deduction", amount: other });
    }
  }
  return out;
}

export function buildOtherDeductionsCsv(
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string
): CsvPack {
  const exploded = buildOtherDeductionRows(lines);
  return {
    filename: `other-deductions-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "particular",
      "amount",
      "sss_no",
      "pagibig_no",
    ],
    rows: exploded.map((row) => {
      const ids = row.directory_employee_id
        ? byDir.get(row.directory_employee_id) ?? {}
        : {};
      return [
        row.employee_code,
        row.last_name,
        row.first_name,
        row.particular,
        row.amount,
        text(ids.sss_number),
        text(ids.pagibig_number),
      ];
    }),
  };
}

const SUPPLEMENTAL_ROSTER_HEADERS = [
  "days_work",
  "cola_per_day",
  "cola_payroll",
  "sea_per_day",
  "sea_payroll",
  "ctpa_per_day",
  "ctpa_payroll",
  "billing_daily_rate",
  "billing_gross_estimate",
] as const;

function supplementalRosterCells(line: PackRegisterLine): number[] {
  return SUPPLEMENTAL_ROSTER_HEADERS.map((key) => earn(line, key));
}

export function buildPayslipRosterCsv(
  lines: PackRegisterLine[],
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `payslips-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "daily_rate_payroll",
      "gross_pay",
      ...SUPPLEMENTAL_ROSTER_HEADERS,
      "sss",
      "philhealth",
      "pagibig",
      "withholding_tax",
      "loans",
      "other",
      "total_deductions",
      "net_pay",
    ],
    rows: lines.map((line) => {
      const d = deduct(line);
      return [
        line.employee_code,
        line.last_name,
        line.first_name,
        n(line.daily_rate),
        n(line.gross_pay),
        ...supplementalRosterCells(line),
        n(d.sss),
        n(d.philhealth),
        n(d.pagibig),
        n(d.withholding_tax),
        n(d.loans),
        n(d.other),
        n(line.total_deductions),
        n(line.net_pay),
      ];
    }),
  };
}

export function buildRegisterDetailCsv(
  lines: PackRegisterLine[],
  policy: ClientSupplementalFlags,
  periodStart: string,
  periodEnd: string
): CsvPack {
  return {
    filename: `register-detail-${periodStart}-${periodEnd}.csv`,
    headers: [
      "employee_code",
      "last_name",
      "first_name",
      "include_cola",
      "include_sea",
      "include_ctpa",
      "daily_rate_payroll",
      "days_work",
      "cola_per_day",
      "cola_payroll",
      "sea_per_day",
      "sea_payroll",
      "ctpa_per_day",
      "ctpa_payroll",
      "billing_daily_rate",
      "billing_gross_estimate",
      "gross_pay",
      "total_deductions",
      "net_pay",
    ],
    rows: lines.map((line) => [
      line.employee_code,
      line.last_name,
      line.first_name,
      policy.include_cola,
      policy.include_sea,
      policy.include_ctpa,
      n(line.daily_rate),
      earn(line, "days_work"),
      earn(line, "cola_per_day"),
      earn(line, "cola_payroll"),
      earn(line, "sea_per_day"),
      earn(line, "sea_payroll"),
      earn(line, "ctpa_per_day"),
      earn(line, "ctpa_payroll"),
      earn(line, "billing_daily_rate"),
      earn(line, "billing_gross_estimate"),
      n(line.gross_pay),
      n(line.total_deductions),
      n(line.net_pay),
    ]),
  };
}

export function buildCutoffCsvPack(
  type: CutoffExportType,
  lines: PackRegisterLine[],
  byDir: Map<string, PackDirectoryIds>,
  periodStart: string,
  periodEnd: string,
  policy?: ClientSupplementalFlags
): CsvPack {
  switch (type) {
    case "wtax":
      return buildWtaxCsv(lines, byDir, periodStart, periodEnd);
    case "sss":
      return buildSssCsv(lines, byDir, periodStart, periodEnd);
    case "philhealth":
      return buildPhilhealthCsv(lines, byDir, periodStart, periodEnd);
    case "pagibig":
      return buildPagibigCsv(lines, byDir, periodStart, periodEnd);
    case "bank":
      return buildBankCsv(lines, byDir, periodStart, periodEnd);
    case "other_deductions":
      return buildOtherDeductionsCsv(lines, byDir, periodStart, periodEnd);
    case "payslips":
      return buildPayslipRosterCsv(lines, periodStart, periodEnd);
    case "register_detail":
      return buildRegisterDetailCsv(
        lines,
        policy ?? {
          include_cola: false,
          include_sea: false,
          include_ctpa: false,
        },
        periodStart,
        periodEnd
      );
  }
}
