/**
 * SOA workbook and debit-memo files from a processed billing run.
 * Copies stored hours / amounts / wrap totals — does not recompute money.
 *
 * Pack enum lives in output-pack.ts so client forms never pull PDF/fs.
 */

import XLSX from "xlsx-js-style";
import autoTable from "jspdf-autotable";
import type { BillingSoa } from "./compute";
import {
  GP_REPORT_GREEN,
  createGpLandscapeReport,
  stampGpReportFooter,
} from "@/lib/reports/gp-report-pdf";
import { loadGpLogoDataUrl } from "@/lib/reports/gp-report-logo-node";
import {
  parseBillingOutputPack,
  type BillingOutputPack,
} from "./output-pack";
import { normalizeBillingExpenses } from "./expenses";
import {
  mainPackBodyValues,
  soaBodyHeadersForPack,
  usesMainRateHoursBody,
} from "./soa-body-main";

export {
  BILLING_OUTPUT_PACKS,
  parseBillingOutputPack,
  type BillingOutputPack,
} from "./output-pack";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export type StoredBillingLine = {
  directory_employee_id?: string | null;
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  department?: string | null;
  position?: string | null;
  billing_daily_rate?: number | null;
  billing_hourly_rate?: number | null;
  hours?: Record<string, unknown> | null;
  amounts?: Record<string, unknown> | null;
  labor?: number | null;
  mandatories?: number | null;
  billable?: number | null;
};

export function withDirectoryPerson(
  line: StoredBillingLine,
  person?: {
    employee_code?: string | null;
    last_name?: string | null;
    first_name?: string | null;
  } | null
): StoredBillingLine {
  if (!person) return line;
  return {
    ...line,
    employee_code: text(line.employee_code) || text(person.employee_code) || null,
    last_name: text(line.last_name) || text(person.last_name) || null,
    first_name: text(line.first_name) || text(person.first_name) || null,
  };
}

export type SoaBodyRow = {
  employee_code: string;
  last_name: string;
  first_name: string;
  daily_rate: number;
  hourly_rate: number;
  reg_hours: number;
  reg_amount: number;
  ot_hours: number;
  ot_amount: number;
  nd_hours: number;
  nd_amount: number;
  nd_ot_hours: number;
  nd_ot_amount: number;
  lh_hours: number;
  lh_amount: number;
  lh_ot_hours: number;
  lh_ot_amount: number;
  lh_nd_hours: number;
  lh_nd_amount: number;
  sh_hours: number;
  sh_amount: number;
  sh_ot_hours: number;
  sh_ot_amount: number;
  rd_hours: number;
  rd_amount: number;
  rd_ot_hours: number;
  rd_ot_amount: number;
  wdo_hours: number;
  wdo_amount: number;
  pto_hours: number;
  pto_amount: number;
  allowance: number;
  labor: number;
  mandatories: number;
  billable: number;
};

function regHours(hours: Record<string, unknown> | null | undefined): number {
  const work = n(hours?.hours_work);
  if (work > 0) return work;
  return n(hours?.actual_regular_hours);
}

export function billingLineToSoaRow(line: StoredBillingLine): SoaBodyRow {
  const hours = line.hours ?? {};
  const amounts = line.amounts ?? {};
  return {
    employee_code: text(line.employee_code),
    last_name: text(line.last_name),
    first_name: text(line.first_name),
    daily_rate: n(line.billing_daily_rate),
    hourly_rate: n(line.billing_hourly_rate),
    reg_hours: regHours(hours),
    reg_amount: n(amounts.regular),
    ot_hours: n(hours.overtime_hours),
    ot_amount: n(amounts.overtime),
    nd_hours: n(hours.night_diff_hours),
    nd_amount: n(amounts.night_diff),
    nd_ot_hours: n(hours.regular_night_ot_hours),
    nd_ot_amount: n(amounts.regular_night_ot),
    lh_hours: n(hours.legal_holiday_hours),
    lh_amount: n(amounts.legal_holiday),
    lh_ot_hours: n(hours.legal_holiday_ot_hours),
    lh_ot_amount: n(amounts.legal_holiday_ot),
    lh_nd_hours: n(hours.legal_holiday_nd_hours),
    lh_nd_amount: n(amounts.legal_holiday_nd),
    sh_hours: n(hours.special_holiday_hours),
    sh_amount: n(amounts.special_holiday),
    sh_ot_hours: n(hours.special_holiday_ot_hours),
    sh_ot_amount: n(amounts.special_holiday_ot),
    rd_hours: n(hours.rest_day_hours),
    rd_amount: n(amounts.rest_day),
    rd_ot_hours: n(hours.rest_day_ot_hours),
    rd_ot_amount: n(amounts.rest_day_ot),
    wdo_hours: n(hours.wdo_hours),
    wdo_amount: n(amounts.wdo),
    pto_hours: n(hours.pto_hours),
    pto_amount: n(amounts.pto),
    allowance: n(amounts.allowance),
    labor: n(line.labor),
    mandatories: n(line.mandatories),
    billable: n(line.billable),
  };
}

export const SOA_BODY_HEADERS = [
  "Employee code",
  "Last name",
  "First name",
  "Daily rate",
  "Hourly rate",
  "Reg hours",
  "Reg amount",
  "OT hours",
  "OT amount",
  "ND hours",
  "ND amount",
  "ND OT hours",
  "ND OT amount",
  "LH hours",
  "LH amount",
  "LH OT hours",
  "LH OT amount",
  "LH ND hours",
  "LH ND amount",
  "SH hours",
  "SH amount",
  "SH OT hours",
  "SH OT amount",
  "RD hours",
  "RD amount",
  "RD OT hours",
  "RD OT amount",
  "WDO hours",
  "WDO amount",
  "PTO hours",
  "PTO amount",
  "Allowance",
  "Labor",
  "Mandatories",
  "Billable",
] as const;

export function soaBodyValues(row: SoaBodyRow): unknown[] {
  return [
    row.employee_code,
    row.last_name,
    row.first_name,
    row.daily_rate,
    row.hourly_rate,
    row.reg_hours,
    row.reg_amount,
    row.ot_hours,
    row.ot_amount,
    row.nd_hours,
    row.nd_amount,
    row.nd_ot_hours,
    row.nd_ot_amount,
    row.lh_hours,
    row.lh_amount,
    row.lh_ot_hours,
    row.lh_ot_amount,
    row.lh_nd_hours,
    row.lh_nd_amount,
    row.sh_hours,
    row.sh_amount,
    row.sh_ot_hours,
    row.sh_ot_amount,
    row.rd_hours,
    row.rd_amount,
    row.rd_ot_hours,
    row.rd_ot_amount,
    row.wdo_hours,
    row.wdo_amount,
    row.pto_hours,
    row.pto_amount,
    row.allowance,
    row.labor,
    row.mandatories,
    row.billable,
  ];
}

export type BillingWrapTotals = Partial<BillingSoa> & {
  amount_due?: number;
};

export type SoaExpenseRow = {
  particular: string;
  amount: number;
};

export type SoaHeader = {
  billing_reference: string;
  client_name: string;
  site: string;
  date_covered: string;
  period_start: string;
  period_end: string;
  billing_date: string;
  headcount: number;
  pack: BillingOutputPack;
  prepared_by_name: string;
  prepared_by_role: string;
  noted_by_name: string;
  noted_by_role: string;
  admin_fee_rate: number;
  vat_rate: number;
  ewt_rate: number;
  labor: number;
  mandatories: number;
  admin_fee_amount: number;
  vat_amount: number;
  ewt_amount: number;
  amount_due: number;
};

/** MAIN FORMAT(date, 'MMM-dd-yyyy') style for DateCovered. */
export function formatSoaDateCovered(
  periodStart: string,
  periodEnd: string
): string {
  const start = formatMainMonthDayYear(periodStart);
  const end = formatMainMonthDayYear(periodEnd);
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} to ${end}`;
}

function formatMainMonthDayYear(ymd: string): string {
  const raw = text(ymd).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return text(ymd);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[Number(m[2]) - 1];
  if (!month) return raw;
  return `${month}-${m[3]}-${m[1]}`;
}

export function buildSoaHeader(input: {
  client_name: string;
  site: string;
  period_start: string;
  period_end: string;
  billing_reference: string;
  billing_date: string;
  headcount: number;
  totals: BillingWrapTotals;
  pack?: BillingOutputPack | string;
  prepared_by_name?: string | null;
  prepared_by_role?: string | null;
  noted_by_name?: string | null;
  noted_by_role?: string | null;
}): SoaHeader {
  return {
    billing_reference: text(input.billing_reference),
    client_name: text(input.client_name),
    site: text(input.site),
    date_covered: formatSoaDateCovered(input.period_start, input.period_end),
    period_start: text(input.period_start).slice(0, 10),
    period_end: text(input.period_end).slice(0, 10),
    billing_date: text(input.billing_date).slice(0, 10),
    headcount: n(input.headcount),
    pack: parseBillingOutputPack(input.pack),
    prepared_by_name: text(input.prepared_by_name),
    prepared_by_role: text(input.prepared_by_role),
    noted_by_name: text(input.noted_by_name),
    noted_by_role: text(input.noted_by_role),
    admin_fee_rate: n(input.totals.admin_fee_rate),
    vat_rate: n(input.totals.vat_rate),
    ewt_rate: n(input.totals.ewt_rate),
    labor: n(input.totals.labor),
    mandatories: n(input.totals.mandatories),
    admin_fee_amount: n(input.totals.admin_fee_amount),
    vat_amount: n(input.totals.vat_amount),
    ewt_amount: n(input.totals.ewt_amount),
    amount_due: n(input.totals.amount_due),
  };
}

export function buildSoaExpenseRows(
  rows: Array<{ particular?: unknown; amount?: unknown }> | null | undefined
): SoaExpenseRow[] {
  return normalizeBillingExpenses(rows);
}

export function soaHeaderPairs(header: SoaHeader): Array<[string, string | number]> {
  return [
    ["Billing reference", header.billing_reference],
    ["Client", header.client_name],
    ["Site", header.site],
    ["Date covered", header.date_covered],
    ["Billing date", header.billing_date],
    ["Pack", header.pack.toUpperCase()],
    ["Headcount", header.headcount],
    ["Prepared by", header.prepared_by_name],
    ["Prepared by role", header.prepared_by_role],
    ["Noted by", header.noted_by_name],
    ["Noted by role", header.noted_by_role],
    ["Admin fee rate", header.admin_fee_rate],
    ["VAT rate", header.vat_rate],
    ["EWT rate", header.ewt_rate],
    ["Labor", header.labor],
    ["Mandatories", header.mandatories],
    ["Admin fee", header.admin_fee_amount],
    ["VAT", header.vat_amount],
    ["EWT", header.ewt_amount],
    ["Amount due", header.amount_due],
  ];
}

export type SoaSheet = {
  pack: BillingOutputPack;
  headers: string[];
  rows: unknown[][];
  wrap: Array<[string, string | number]>;
  header: SoaHeader;
  expenses: SoaExpenseRow[];
};

export function soaSheet(input: {
  pack: BillingOutputPack | string;
  client_name: string;
  site: string;
  period_start: string;
  period_end: string;
  billing_reference: string;
  billing_date: string;
  lines: StoredBillingLine[];
  totals: BillingWrapTotals;
  expenses?: Array<{ particular?: unknown; amount?: unknown }> | null;
  prepared_by_name?: string | null;
  prepared_by_role?: string | null;
  noted_by_name?: string | null;
  noted_by_role?: string | null;
}): SoaSheet {
  const pack = parseBillingOutputPack(input.pack);
  const headers = usesMainRateHoursBody(pack)
    ? [...soaBodyHeadersForPack(pack)]
    : [...SOA_BODY_HEADERS];
  const rows = input.lines.map((line) =>
    usesMainRateHoursBody(pack)
      ? mainPackBodyValues(pack, line)
      : soaBodyValues(billingLineToSoaRow(line))
  );
  const header = buildSoaHeader({
    ...input,
    headcount: input.lines.length,
    pack,
  });
  const expenses = buildSoaExpenseRows(input.expenses);
  const wrap: Array<[string, string | number]> = [
    ["Client", text(input.client_name)],
    ["Site", text(input.site)],
    ["Period", `${text(input.period_start)} – ${text(input.period_end)}`],
    ["Billing reference", text(input.billing_reference)],
    ["Billing date", text(input.billing_date)],
    ["Pack", pack.toUpperCase()],
    ["Headcount", input.lines.length],
    ["Labor", n(input.totals.labor)],
    ["Mandatories", n(input.totals.mandatories)],
    ["Subtotal", n(input.totals.subtotal)],
    ["Admin fee rate", n(input.totals.admin_fee_rate)],
    ["Admin fee", n(input.totals.admin_fee_amount)],
    ["Vatable", n(input.totals.vatable)],
    ["VAT rate", n(input.totals.vat_rate)],
    ["VAT", n(input.totals.vat_amount)],
    ["EWT rate", n(input.totals.ewt_rate)],
    ["EWT", n(input.totals.ewt_amount)],
    ["Amount due", n(input.totals.amount_due)],
  ];
  return { pack, headers, rows, wrap, header, expenses };
}

export function soaFilename(
  pack: BillingOutputPack | string,
  billingReference: string
): string {
  const parsed = parseBillingOutputPack(pack);
  const label = parsed === "debit_memo" ? "GENERIC" : parsed.toUpperCase();
  return `SOA-${label}-${text(billingReference) || "BILL"}.xlsx`;
}

export function debitMemoFilename(billingReference: string): string {
  return `DM-${text(billingReference) || "BILL"}.pdf`;
}

export type DebitMemo = {
  title: string;
  client_name: string;
  site: string;
  period_start: string;
  period_end: string;
  billing_reference: string;
  billing_date: string;
  headcount: number;
  labor: number;
  mandatories: number;
  subtotal: number;
  admin_fee_amount: number;
  vat_amount: number;
  ewt_amount: number;
  amount_due: number;
};

export function buildDebitMemo(input: {
  client_name: string;
  site: string;
  period_start: string;
  period_end: string;
  billing_reference: string;
  billing_date: string;
  headcount: number;
  totals: BillingWrapTotals;
}): DebitMemo {
  return {
    title: "Debit memo",
    client_name: text(input.client_name),
    site: text(input.site),
    period_start: text(input.period_start),
    period_end: text(input.period_end),
    billing_reference: text(input.billing_reference),
    billing_date: text(input.billing_date),
    headcount: n(input.headcount),
    labor: n(input.totals.labor),
    mandatories: n(input.totals.mandatories),
    subtotal: n(input.totals.subtotal),
    admin_fee_amount: n(input.totals.admin_fee_amount),
    vat_amount: n(input.totals.vat_amount),
    ewt_amount: n(input.totals.ewt_amount),
    amount_due: n(input.totals.amount_due),
  };
}

const headerStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { fgColor: { rgb: "FFEFEFEF" } },
};

const moneyStyle: XLSX.CellStyle = {
  numFmt: "#,##0.00",
  alignment: { horizontal: "right" },
};

export function soaWorkbookBuffer(sheet: SoaSheet): Buffer {
  const wb = XLSX.utils.book_new();

  const headerWs = XLSX.utils.aoa_to_sheet(soaHeaderPairs(sheet.header));
  headerWs["!cols"] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, headerWs, "Header");

  const bodyAoa = [sheet.headers, ...sheet.rows];
  const bodyWs = XLSX.utils.aoa_to_sheet(bodyAoa);
  for (let c = 0; c < sheet.headers.length; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = bodyWs[addr];
    if (cell) cell.s = headerStyle;
  }
  const moneyCols = new Set(
    sheet.headers
      .map((h, i) =>
        h.includes("amount") ||
        h.includes("rate") ||
        h === "Allowance" ||
        h === "Labor" ||
        h === "Mandatories" ||
        h === "Billable" ||
        h === "Daily rate" ||
        h === "Hourly rate"
          ? i
          : -1
      )
      .filter((i) => i >= 0)
  );
  for (let r = 1; r <= sheet.rows.length; r += 1) {
    for (const c of moneyCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = bodyWs[addr];
      if (cell && typeof cell.v === "number") cell.s = moneyStyle;
    }
  }
  bodyWs["!cols"] = sheet.headers.map((h) => ({
    wch: Math.max(12, h.length + 2),
  }));
  XLSX.utils.book_append_sheet(wb, bodyWs, "Body");

  const expenseAoa: unknown[][] = [
    ["Particular", "Amount"],
    ...sheet.expenses.map((row) => [row.particular, row.amount]),
  ];
  const expenseWs = XLSX.utils.aoa_to_sheet(expenseAoa);
  for (let c = 0; c < 2; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = expenseWs[addr];
    if (cell) cell.s = headerStyle;
  }
  for (let r = 1; r <= sheet.expenses.length; r += 1) {
    const addr = XLSX.utils.encode_cell({ r, c: 1 });
    const cell = expenseWs[addr];
    if (cell && typeof cell.v === "number") cell.s = moneyStyle;
  }
  expenseWs["!cols"] = [{ wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, expenseWs, "Expense");

  const wrapWs = XLSX.utils.aoa_to_sheet(sheet.wrap);
  wrapWs["!cols"] = [{ wch: 22 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wrapWs, "Wrap");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const GP_GREEN = GP_REPORT_GREEN;

function pdfSafe(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function peso(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function debitMemoToPdf(memo: DebitMemo): Uint8Array {
  const siteLine = [
    pdfSafe(memo.site) || "Site",
    `${memo.period_start} – ${memo.period_end}`,
    memo.billing_reference,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const { doc, contentTop } = createGpLandscapeReport({
    title: "Debit memo",
    subtitle: `${pdfSafe(memo.client_name) || "Client"}  ·  ${siteLine}`,
    logoDataUrl: loadGpLogoDataUrl(),
  });

  autoTable(doc, {
    startY: contentTop,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
    body: [
      ["Billing reference", memo.billing_reference],
      ["Billing date", memo.billing_date],
      ["Headcount", String(memo.headcount)],
    ],
  });

  const afterMeta =
    (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? contentTop + 24;

  autoTable(doc, {
    startY: afterMeta + 6,
    theme: "grid",
    head: [["", "Amount"]],
    body: [
      ["Labor", peso(memo.labor)],
      ["Mandatories", peso(memo.mandatories)],
      ["Subtotal", peso(memo.subtotal)],
      ["Admin fee", peso(memo.admin_fee_amount)],
      ["VAT", peso(memo.vat_amount)],
      ["EWT", `-${peso(memo.ewt_amount)}`],
      ["Amount due", peso(memo.amount_due)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: GP_GREEN, textColor: 255 },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 6) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  stampGpReportFooter(doc);
  return new Uint8Array(doc.output("arraybuffer"));
}
