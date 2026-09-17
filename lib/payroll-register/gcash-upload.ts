/**
 * GCash FOR UPLOADING workbook — ops Excel from MAIN payroll_summary GCash rows.
 * Sheets: GCASH BATCH + GCASH INDIVIDUAL (template match).
 * Green/white chrome matches GP-Client cutoff / transmittal exports.
 */

import XLSX from "xlsx-js-style";
import {
  applyGpTableSheetStyles,
  styleMetaLabelCell,
  styleMetaValueCell,
  styleTitleCell,
  styleTotalsRow,
} from "./gp-report-sheet-style";
import {
  gcashDisplayName,
  type DisbursementPerson,
} from "./disbursement-debit-memo";
import { parseFundingPayThrough } from "./funding-memo";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export type GcashUploadRow = {
  no: number;
  client: string;
  department: string;
  mobile: string;
  name: string;
  amount: number;
  charges: string;
};

export function gcashUploadRows(
  people: DisbursementPerson[],
  defaultClient?: string
): GcashUploadRow[] {
  const rows = people
    .filter((p) => parseFundingPayThrough(p.pay_through) === "gcash")
    .filter((p) => text(p.gcash) && n(p.net_pay) !== 0)
    .map((p, i) => ({
      no: i + 1,
      client: text(p.client_name) || text(defaultClient) || "—",
      department: text(p.department) || "—",
      mobile: text(p.gcash).replace(/\D/g, "") || text(p.gcash),
      name: gcashDisplayName(p),
      amount: round2(n(p.net_pay)),
      charges: "GCASH",
    }));
  return rows.map((r, i) => ({ ...r, no: i + 1 }));
}

const HEADERS = [
  "No.",
  "Client",
  "Department",
  "Mobile Number",
  "Name",
  "Amount",
  "Charges",
  "Print name",
  "Signature",
  "Date",
  "Ref no.",
  "Employee charges",
  "Amount",
] as const;

function cashPayrollSheet(
  payOut: string,
  rows: GcashUploadRow[],
  withSignOff: boolean
): XLSX.WorkSheet {
  const total = round2(rows.reduce((a, r) => a + r.amount, 0));
  const body: unknown[][] = [
    ["GREEN PASTURE PEOPLE MANAGEMENT INC."],
    ["GCash for uploading"],
    ["Pay-out date", payOut],
    [],
    [...HEADERS],
    ...rows.map((r) => [
      r.no,
      r.client,
      r.department,
      r.mobile,
      r.name,
      r.amount,
      r.charges,
      "",
      "",
      "",
      "",
      "",
      r.amount,
    ]),
    ["", "", "", "", "TOTAL", total, "", "", "", "", "", "", ""],
  ];
  if (withSignOff) {
    body.push(
      [],
      ["", "", "", "", "GP charge"],
      ["", "", "", "", "All in"],
      ["", "", "", "", "GCash", total],
      ["", "", "", "", "TOTAL", total],
      [],
      ["", "", "", "", "Prepared by:", "Approved by:", "", "Noted by:"]
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(body);
  styleTitleCell(ws["A1"]);
  styleTitleCell(ws["A2"]);
  styleMetaLabelCell(ws["A3"]);
  styleMetaValueCell(ws["B3"]);
  const headerRow = 4;
  const dataEnd = 4 + rows.length;
  const totalsRow = 5 + rows.length;
  applyGpTableSheetStyles(ws, {
    headerRow,
    dataStartRow: 5,
    dataEndRow: dataEnd,
    totalsRow,
    colCount: HEADERS.length,
    moneyCols: [5, 12],
    textCols: [1, 2, 3, 4, 6],
    colWidths: [6, 16, 14, 14, 22, 12, 10, 14, 12, 10, 10, 14, 12],
  });
  if (withSignOff) {
    // Re-emphasize sign-off TOTAL line
    styleTotalsRow(ws, totalsRow, HEADERS.length, {
      moneyCols: new Set([5, 12]),
    });
  }
  return ws;
}

export function buildGcashUploadWorkbook(input: {
  pay_out_date: string;
  people: DisbursementPerson[];
  client_name?: string;
}): Buffer {
  const payOut = text(input.pay_out_date);
  const rows = gcashUploadRows(input.people, input.client_name);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    cashPayrollSheet(payOut, rows, false),
    "GCASH BATCH"
  );
  XLSX.utils.book_append_sheet(
    wb,
    cashPayrollSheet(payOut, rows, true),
    "GCASH INDIVIDUAL"
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function gcashUploadFilename(periodLabel: string): string {
  const p = text(periodLabel).replace(/\s+/g, "-") || "period";
  return `GCASH-FOR-UPLOADING-${p}.xlsx`;
}
