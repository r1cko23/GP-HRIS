/**
 * Disbursement Debit Memo workbook — ports GREENHRISMAIN sp_posted-dm-* shapes.
 * Sheets: PAYROLL REPORT, SUMMARY, ATM PAYROLL, GCASH PAYROLL
 * (not Client SOA billing debit memo).
 */

import XLSX from "xlsx-js-style";
import {
  applyGpTableSheetStyles,
  autofitColWidths,
  styleMetaLabelCell,
  styleMetaValueCell,
  styleSectionBanner,
  styleTitleCell,
  GP_SHEET,
  gpBorderAll,
} from "./gp-report-sheet-style";
import {
  parseFundingPayThrough,
  type FundingPerson,
  type FundingPayThrough,
} from "./funding-memo";

export type DisbursementPerson = FundingPerson & {
  middle_name?: string | null;
  department?: string | null;
  daily_rate?: number | null;
  rh_worked?: number | null;
  gross_pay?: number | null;
  client_name?: string | null;
  /** MAIN PAYROLL REPORT extras */
  meal?: number | null;
  sil_adj?: number | null;
  allowance?: number | null;
  thirteenth_month?: number | null;
  sss_ee?: number | null;
  hdmf_ee?: number | null;
  phic_ee?: number | null;
  sss_er?: number | null;
  sss_provident_er?: number | null;
  sss_ecc?: number | null;
  hdmf_er?: number | null;
  phic_er?: number | null;
};

/** Which kinsena government block to fill (MAIN dual-half layout). */
export type DebitMemoPeriodHalf = "first" | "second";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** MAIN ATM name: LAST, FIRST M. */
export function atmDisplayName(p: DisbursementPerson): string {
  const last = text(p.last_name);
  const first = text(p.first_name);
  const mid = text(p.middle_name);
  const initial = mid ? ` ${mid.charAt(0).toUpperCase()}.` : "";
  if (last && first) return `${last}, ${first}${initial}`;
  return last || first || text(p.employee_code);
}

/** MAIN GCash name: FIRST LAST */
export function gcashDisplayName(p: DisbursementPerson): string {
  const first = text(p.first_name);
  const last = text(p.last_name);
  if (first && last) return `${first} ${last}`;
  return first || last || text(p.employee_code);
}

export type AtmReportRow = {
  accountNo: string;
  amount: number;
  name: string;
  dailyRate: number;
  rhWorked: number;
  deptStore: string;
};

export type GcashReportRow = {
  mobile: string;
  amount: number;
  name: string;
  dailyRate: number;
  rhWorked: number;
  deptStore: string;
};

export type StoreChannelTotals = {
  department: string;
  atmPax: number;
  atmNet: number;
  chequePax: number;
  chequeNet: number;
  gcashPax: number;
  gcashNet: number;
  cashPax: number;
  cashNet: number;
  holdPax: number;
  holdNet: number;
  totalPax: number;
  net: number;
  gross: number;
  meal: number;
  silAdj: number;
  allowance: number;
  thirteenthMonth: number;
  sssEe: number;
  hdmfEe: number;
  phicEe: number;
  sssEr: number;
  sssProvidentEr: number;
  sssEcc: number;
  hdmfEr: number;
  phicEr: number;
};

/**
 * Detail headers matching MAIN Debit Memo PAYROLL REPORT row 5
 * (41 columns; trailing blank in sample omitted).
 */
export const PAYROLL_REPORT_DETAIL_HEADERS = [
  "CLIENT NAME",
  "PAX",
  "ATM PAYROLL",
  "PAX",
  "CHEQUE PAYROLL",
  "PAX",
  "GCASH PAYROLL",
  "HOLD W/ NC",
  "MEAL",
  "SIL/ADJ",
  "ALLOWANCE",
  "TOTAL PAX",
  "GROSS",
  "NET ",
  "13THMONTH PAY",
  "SSS",
  "HDMF",
  "PHIC",
  "SSS",
  "PROVIDENT",
  "EC",
  "HDMF",
  "PHIC",
  "13THMONTH PAY",
  "SSS",
  "HDMF",
  "PHIC",
  "SSS",
  "PROVIDENT",
  "EC",
  "HDMF",
  "PHIC",
  "SSS",
  "HDMF",
  "PHIC",
  "SSS",
  "PROVIDENT",
  "EC",
  "HDMF",
  "PHIC",
  "13THMONTH PAY",
] as const;

function channelOf(p: DisbursementPerson): FundingPayThrough {
  return parseFundingPayThrough(p.pay_through);
}

export function atmReportRows(people: DisbursementPerson[]): AtmReportRow[] {
  return people
    .filter((p) => channelOf(p) === "atm")
    .map((p) => ({
      accountNo: text(p.bank_account_no),
      amount: round2(n(p.net_pay)),
      name: atmDisplayName(p),
      dailyRate: round2(n(p.daily_rate)),
      rhWorked: round2(n(p.rh_worked)),
      deptStore: text(p.department) || "—",
    }))
    .sort((a, b) =>
      a.deptStore.localeCompare(b.deptStore) || a.name.localeCompare(b.name)
    );
}

export function gcashReportRows(people: DisbursementPerson[]): GcashReportRow[] {
  return people
    .filter((p) => channelOf(p) === "gcash")
    .map((p) => ({
      mobile: text(p.gcash),
      amount: round2(n(p.net_pay)),
      name: gcashDisplayName(p),
      dailyRate: round2(n(p.daily_rate)),
      rhWorked: round2(n(p.rh_worked)),
      deptStore: text(p.department) || "—",
    }))
    .sort((a, b) =>
      a.deptStore.localeCompare(b.deptStore) || a.name.localeCompare(b.name)
    );
}

function emptyStore(department: string): StoreChannelTotals {
  return {
    department,
    atmPax: 0,
    atmNet: 0,
    chequePax: 0,
    chequeNet: 0,
    gcashPax: 0,
    gcashNet: 0,
    cashPax: 0,
    cashNet: 0,
    holdPax: 0,
    holdNet: 0,
    totalPax: 0,
    net: 0,
    gross: 0,
    meal: 0,
    silAdj: 0,
    allowance: 0,
    thirteenthMonth: 0,
    sssEe: 0,
    hdmfEe: 0,
    phicEe: 0,
    sssEr: 0,
    sssProvidentEr: 0,
    sssEcc: 0,
    hdmfEr: 0,
    phicEr: 0,
  };
}

export function payrollReportByStore(
  people: DisbursementPerson[]
): StoreChannelTotals[] {
  const map = new Map<string, StoreChannelTotals>();
  for (const p of people) {
    const dept = text(p.department) || "—";
    let row = map.get(dept);
    if (!row) {
      row = emptyStore(dept);
      map.set(dept, row);
    }
    const amount = round2(n(p.net_pay));
    const gross = round2(n(p.gross_pay));
    const ch = channelOf(p);
    if (ch === "atm") {
      row.atmPax += 1;
      row.atmNet = round2(row.atmNet + amount);
    } else if (ch === "gcash") {
      row.gcashPax += 1;
      row.gcashNet = round2(row.gcashNet + amount);
    } else if (ch === "hold") {
      row.holdPax += 1;
      row.holdNet = round2(row.holdNet + amount);
    } else if (ch === "cheque") {
      const raw = text(p.pay_through).toLowerCase();
      if (raw.includes("cheque") || raw.includes("check")) {
        row.chequePax += 1;
        row.chequeNet = round2(row.chequeNet + amount);
      } else {
        row.cashPax += 1;
        row.cashNet = round2(row.cashNet + amount);
      }
    }
    row.totalPax += 1;
    row.net = round2(row.net + amount);
    row.gross = round2(row.gross + gross);
    row.meal = round2(row.meal + n(p.meal));
    row.silAdj = round2(row.silAdj + n(p.sil_adj));
    row.allowance = round2(row.allowance + n(p.allowance));
    row.thirteenthMonth = round2(
      row.thirteenthMonth + n(p.thirteenth_month)
    );
    row.sssEe = round2(row.sssEe + n(p.sss_ee));
    row.hdmfEe = round2(row.hdmfEe + n(p.hdmf_ee));
    row.phicEe = round2(row.phicEe + n(p.phic_ee));
    row.sssEr = round2(row.sssEr + n(p.sss_er));
    row.sssProvidentEr = round2(
      row.sssProvidentEr + n(p.sss_provident_er)
    );
    row.sssEcc = round2(row.sssEcc + n(p.sss_ecc));
    row.hdmfEr = round2(row.hdmfEr + n(p.hdmf_er));
    row.phicEr = round2(row.phicEr + n(p.phic_er));
  }
  return [...map.values()].sort((a, b) =>
    a.department.localeCompare(b.department)
  );
}

/** Infer MAIN half from period end day: ≤15 → 2nd half (15th), else 1st half (30th). */
export function debitMemoHalfFromPeriodEnd(
  periodEnd: string | Date | null | undefined
): DebitMemoPeriodHalf {
  if (periodEnd == null) return "second";
  const s = typeof periodEnd === "string" ? periodEnd : periodEnd.toISOString();
  const day = Number(s.slice(8, 10));
  if (!Number.isFinite(day)) return "second";
  return day > 15 ? "first" : "second";
}

function blank(nCols: number): unknown[] {
  return Array.from({ length: nCols }, () => "");
}

function govBlock(s: StoreChannelTotals): number[] {
  return [
    s.sssEe,
    s.hdmfEe,
    s.phicEe,
    s.sssEr,
    s.sssProvidentEr,
    s.sssEcc,
    s.hdmfEr,
    s.phicEr,
  ];
}

/** One PAYROLL REPORT data row in MAIN column order. */
export function payrollReportDetailRow(
  s: StoreChannelTotals,
  half: DebitMemoPeriodHalf
): unknown[] {
  const cols = PAYROLL_REPORT_DETAIL_HEADERS.length;
  const row = blank(cols);
  row[0] = s.department;
  row[1] = s.atmPax || "";
  row[2] = s.atmNet || "";
  row[3] = s.chequePax + s.cashPax || "";
  row[4] = round2(s.chequeNet + s.cashNet) || "";
  row[5] = s.gcashPax || "";
  row[6] = s.gcashNet || "";
  row[7] = s.holdNet || "";
  row[8] = s.meal || "";
  row[9] = s.silAdj || "";
  row[10] = s.allowance || "";
  row[11] = s.totalPax || "";
  row[12] = s.gross || "";
  row[13] = s.net || "";
  row[14] = s.thirteenthMonth || "";

  const gov = govBlock(s);
  const firstStart = 15; // 1st half EE+ER (8 cols)
  const secondStart = 24; // 2nd half EE+ER (8 cols) — col 23 is 2nd-half 13th
  const totalStart = 32; // TOTAL EE+ER (8 cols) — col 40 is total 13th

  row[23] = ""; // other-half 13th
  if (half === "first") {
    for (let i = 0; i < 8; i += 1) row[firstStart + i] = gov[i] || "";
    for (let i = 0; i < 8; i += 1) row[secondStart + i] = "";
  } else {
    for (let i = 0; i < 8; i += 1) row[firstStart + i] = "";
    row[23] = s.thirteenthMonth || "";
    for (let i = 0; i < 8; i += 1) row[secondStart + i] = gov[i] || "";
  }
  for (let i = 0; i < 8; i += 1) row[totalStart + i] = gov[i] || "";
  row[40] = s.thirteenthMonth || "";
  return row;
}

function stylePayrollReportSheet(
  ws: XLSX.WorkSheet,
  storeCount: number
) {
  const colCount = PAYROLL_REPORT_DETAIL_HEADERS.length;
  styleTitleCell(ws["A1"]);
  styleMetaLabelCell(ws["A3"]);
  styleMetaValueCell(ws["C3"]);
  // Group banner row (r=2 in 0-index is Excel row 3 — our row index 2 is CLIENT NAME: / halves)
  const halfRow = 2;
  const groupRow = 3;
  const headerRow = 4;
  for (let c = 0; c < colCount; c += 1) {
    for (const r of [halfRow, groupRow]) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell || cell.v === "" || cell.v == null) continue;
      cell.s = {
        font: { bold: true, sz: 9, color: { rgb: GP_SHEET.headerText } },
        fill: { patternType: "solid", fgColor: { rgb: GP_SHEET.headerFill } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: gpBorderAll,
      };
    }
  }
  applyGpTableSheetStyles(ws, {
    headerRow,
    dataStartRow: 5,
    dataEndRow: 4 + storeCount,
    totalsRow: storeCount > 0 ? 5 + storeCount : undefined,
    colCount,
    moneyCols: [
      2, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    ],
    textCols: [0],
    colWidths: [
      22, 6, 12, 6, 12, 6, 12, 10, 8, 8, 10, 8, 11, 11, 12, 8, 8, 8, 8, 9, 6, 8,
      8, 12, 8, 8, 8, 8, 9, 6, 8, 8, 8, 8, 8, 8, 9, 6, 8, 8, 12,
    ],
  });
  ws["!merges"] = [
    { s: { r: 2, c: 15 }, e: { r: 2, c: 22 } },
    { s: { r: 2, c: 24 }, e: { r: 2, c: 31 } },
    { s: { r: 2, c: 32 }, e: { r: 2, c: 39 } },
    { s: { r: 3, c: 15 }, e: { r: 3, c: 17 } },
    { s: { r: 3, c: 18 }, e: { r: 3, c: 22 } },
    { s: { r: 3, c: 24 }, e: { r: 3, c: 26 } },
    { s: { r: 3, c: 27 }, e: { r: 3, c: 31 } },
    { s: { r: 3, c: 32 }, e: { r: 3, c: 34 } },
    { s: { r: 3, c: 35 }, e: { r: 3, c: 39 } },
  ];
  ws["!rows"] = [{ hpt: 22 }, {}, { hpt: 18 }, { hpt: 18 }, { hpt: 30 }];
  autofitColWidths(ws, {
    min: 6,
    max: 18,
    floors: [
      22, 6, 12, 6, 12, 6, 12, 10, 8, 8, 10, 8, 11, 11, 12, 8, 8, 8, 8, 9, 6, 8,
      8, 12, 8, 8, 8, 8, 9, 6, 8, 8, 8, 8, 8, 8, 9, 6, 8, 8, 12,
    ],
    colCount,
  });
}

function buildPayrollReportSheet(input: {
  client: string;
  payOut: string;
  stores: StoreChannelTotals[];
  half: DebitMemoPeriodHalf;
}): XLSX.WorkSheet {
  const cols = PAYROLL_REPORT_DETAIL_HEADERS.length;
  const halfBanner = blank(cols);
  halfBanner[0] = "CLIENT NAME:";
  halfBanner[2] = input.client;
  halfBanner[15] = "1st half (30th)";
  halfBanner[24] = "2nd half (15th)";
  halfBanner[32] = "TOTAL";

  const groupBanner = blank(cols);
  groupBanner[15] = "GOVERNMENT EE";
  groupBanner[18] = "GOVERNMENT ER";
  groupBanner[24] = "GOVERNMENT EE";
  groupBanner[27] = "GOVERNMENT ER";
  groupBanner[32] = "GOVERNMENT EE";
  groupBanner[35] = "GOVERNMENT ER";

  const totals = emptyStore("TOTAL");
  for (const s of input.stores) {
    totals.atmPax += s.atmPax;
    totals.atmNet = round2(totals.atmNet + s.atmNet);
    totals.chequePax += s.chequePax;
    totals.chequeNet = round2(totals.chequeNet + s.chequeNet);
    totals.cashPax += s.cashPax;
    totals.cashNet = round2(totals.cashNet + s.cashNet);
    totals.gcashPax += s.gcashPax;
    totals.gcashNet = round2(totals.gcashNet + s.gcashNet);
    totals.holdPax += s.holdPax;
    totals.holdNet = round2(totals.holdNet + s.holdNet);
    totals.totalPax += s.totalPax;
    totals.net = round2(totals.net + s.net);
    totals.gross = round2(totals.gross + s.gross);
    totals.meal = round2(totals.meal + s.meal);
    totals.silAdj = round2(totals.silAdj + s.silAdj);
    totals.allowance = round2(totals.allowance + s.allowance);
    totals.thirteenthMonth = round2(
      totals.thirteenthMonth + s.thirteenthMonth
    );
    totals.sssEe = round2(totals.sssEe + s.sssEe);
    totals.hdmfEe = round2(totals.hdmfEe + s.hdmfEe);
    totals.phicEe = round2(totals.phicEe + s.phicEe);
    totals.sssEr = round2(totals.sssEr + s.sssEr);
    totals.sssProvidentEr = round2(
      totals.sssProvidentEr + s.sssProvidentEr
    );
    totals.sssEcc = round2(totals.sssEcc + s.sssEcc);
    totals.hdmfEr = round2(totals.hdmfEr + s.hdmfEr);
    totals.phicEr = round2(totals.phicEr + s.phicEr);
  }

  const aoa: unknown[][] = [
    [input.payOut],
    [],
    halfBanner,
    groupBanner,
    [...PAYROLL_REPORT_DETAIL_HEADERS],
    ...input.stores.map((s) => payrollReportDetailRow(s, input.half)),
    payrollReportDetailRow(totals, input.half),
  ];
  // Force TOTAL label
  const last = aoa[aoa.length - 1] as unknown[];
  last[0] = "TOTAL";

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  stylePayrollReportSheet(ws, input.stores.length);
  return ws;
}

function buildSummarySheet(input: {
  title: string;
  payOut: string;
  stores: StoreChannelTotals[];
  people: DisbursementPerson[];
  /** Optional override when per-person gross is incomplete (MAIN SUMMARY). */
  grossAmount?: number | null;
}): XLSX.WorkSheet {
  const stores = input.stores;
  const atmTotal = round2(stores.reduce((a, s) => a + s.atmNet, 0));
  const cashTotal = round2(
    stores.reduce((a, s) => a + s.chequeNet + s.cashNet, 0)
  );
  const gcashTotal = round2(stores.reduce((a, s) => a + s.gcashNet, 0));
  const holdTotal = round2(stores.reduce((a, s) => a + s.holdNet, 0));
  const grand = round2(atmTotal + cashTotal + gcashTotal + holdTotal);
  const grossFromPeople = round2(
    input.people.reduce((a, p) => a + n(p.gross_pay), 0)
  );
  const grossAmount = round2(
    input.grossAmount != null && Number.isFinite(Number(input.grossAmount))
      ? Number(input.grossAmount)
      : stores.reduce((a, s) => a + s.gross, 0) || grossFromPeople
  );

  const atmPax = input.people.filter((p) => channelOf(p) === "atm").length;
  const cashPax = input.people.filter((p) => channelOf(p) === "cheque")
    .length;
  const gcashPax = input.people.filter((p) => channelOf(p) === "gcash").length;
  const finalPayPax = input.people.filter((p) => channelOf(p) === "hold")
    .length;

  const section = (
    label: string,
    amountKey: (s: StoreChannelTotals) => number
  ): unknown[][] => {
    const lines: unknown[][] = [[], [], [label]];
    for (const s of stores) {
      const amt = amountKey(s);
      lines.push(["", "", s.department, amt || ""]);
    }
    lines.push([
      "",
      "",
      "TOTAL :",
      round2(stores.reduce((a, s) => a + amountKey(s), 0)),
    ]);
    return lines;
  };

  // MAIN COD SUMMARY shape: ATM / CASH / GCASH + GROSS AMOUNT + headcounts
  const aoa: unknown[][] = [
    ["", "GREEN PASTURE PEOPLE MANAGEMENT INC."],
    [],
    [],
    ["", input.payOut],
    [],
    [],
    ["", "PAYROLL SUMMARY :", input.title],
    ...section("ATM PAYROLL", (s) => s.atmNet),
    ...section("CASH PAYROLL", (s) => round2(s.chequeNet + s.cashNet)),
    ...section("GCASH PAYROLL", (s) => s.gcashNet),
    [],
    ["", "", "GRAND TOTAL :", grand],
    [],
    ["", "", "GROSS AMOUNT:", grossAmount],
    ["", "", "CASH HEADCOUNT:", cashPax],
    ["", "", "ATM HEADCOUNT:", atmPax],
    ["", "", "GCASH HEADCOUNT:", gcashPax],
    ["", "", "FINAL PAY:", finalPayPax],
    ["", "", "TOTAL HEADCOUNT:", atmPax + cashPax + gcashPax + finalPayPax],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  styleTitleCell(ws["B1"]);
  styleTitleCell(ws["B4"]);
  styleMetaLabelCell(ws["B7"]);
  styleMetaValueCell(ws["C7"]);
  const json = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];
  for (let r = 0; r < json.length; r += 1) {
    const v = String(json[r]?.[0] ?? json[r]?.[2] ?? "");
    if (
      v === "ATM PAYROLL" ||
      v === "CASH PAYROLL" ||
      v === "GCASH PAYROLL"
    ) {
      styleSectionBanner(ws, r, 4);
    }
  }
  autofitColWidths(ws, {
    min: 10,
    max: 40,
    floors: [4, 28, 28, 14],
    colCount: 4,
  });
  return ws;
}

function buildAtmPayrollSheet(input: {
  payOut: string;
  savings: string;
  rows: AtmReportRow[];
}): XLSX.WorkSheet {
  const total = round2(input.rows.reduce((a, r) => a + r.amount, 0));
  const aoa: unknown[][] = [
    [input.payOut],
    [],
    ["Banco De Oro"],
    ["Julia Vargas Branch"],
    ["Ortigas, Pasig City"],
    [],
    ["Gentlemen,"],
    [],
    [
      "This is to authorize your branch to debit the amount of P",
      "",
      "",
      total,
      "from Savings Account",
    ],
    [
      `# ${input.savings} under the name of Green Pasture People Management Inc for credit to various savings accounts, viz;`,
    ],
    [],
    [
      "",
      "Account No.",
      "Amount",
      "Name of Employee",
      "Daily Rate",
      "RH Worked",
      "Dept/Store",
    ],
    ...input.rows.map((r, i) => [
      i + 1,
      r.accountNo,
      r.amount,
      r.name,
      r.dailyRate,
      r.rhWorked,
      r.deptStore,
    ]),
    ["", "TOTAL", total, input.rows.length, "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  styleTitleCell(ws["A1"]);
  styleTitleCell(ws["A3"]);
  applyGpTableSheetStyles(ws, {
    headerRow: 11,
    dataStartRow: 12,
    dataEndRow: 11 + input.rows.length,
    totalsRow: 12 + input.rows.length,
    colCount: 7,
    moneyCols: [2, 4],
    textCols: [1, 3, 6],
    colWidths: [6, 16, 12, 36, 11, 11, 20],
  });
  autofitColWidths(ws, {
    min: 8,
    max: 42,
    floors: [6, 16, 12, 36, 11, 11, 18],
    colCount: 7,
  });
  return ws;
}

function buildGcashPayrollSheet(input: {
  payOut: string;
  rows: GcashReportRow[];
}): XLSX.WorkSheet {
  const total = round2(input.rows.reduce((a, r) => a + r.amount, 0));
  const headers = [
    "No.",
    "Mobile Number",
    "Name",
    "Amount",
    "Daily Rate",
    "RH Work",
    "BRANCH",
  ];
  const aoa: unknown[][] = [
    ["GREEN PASTURE PEOPLE MANAGEMENT INC."],
    [],
    [input.payOut],
    [],
    ["", "CASH PAYROLL SUMMARY"],
    [],
    headers,
    ...input.rows.map((r, i) => [
      i + 1,
      r.mobile,
      r.name,
      r.amount,
      r.dailyRate,
      r.rhWorked,
      r.deptStore,
    ]),
    ["", "", "TOTAL", total, "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  styleTitleCell(ws["A1"]);
  styleTitleCell(ws["A3"]);
  styleTitleCell(ws["B5"]);
  applyGpTableSheetStyles(ws, {
    headerRow: 6,
    dataStartRow: 7,
    dataEndRow: 6 + input.rows.length,
    totalsRow: 7 + input.rows.length,
    colCount: headers.length,
    moneyCols: [3, 4],
    textCols: [1, 2, 6],
    colWidths: [6, 16, 28, 12, 11, 10, 18],
  });
  autofitColWidths(ws, {
    min: 8,
    max: 40,
    floors: [6, 16, 28, 12, 11, 10, 18],
    colCount: headers.length,
  });
  return ws;
}

export function buildDisbursementDebitMemoWorkbook(input: {
  client_name: string;
  title: string;
  pay_out_date: string;
  people: DisbursementPerson[];
  gp_savings_account?: string;
  /** Defaults to "second" (pay on 15th / period end ≤15). */
  period_half?: DebitMemoPeriodHalf;
  /** SUMMARY GROSS AMOUNT override when people lack gross_pay. */
  gross_amount?: number | null;
}): Buffer {
  const client = text(input.client_name) || "Client";
  const title = text(input.title) || "Payroll";
  const payOut = text(input.pay_out_date);
  const savings = text(input.gp_savings_account) || "2110254455";
  const half = input.period_half ?? "second";
  const people = input.people;
  const stores = payrollReportByStore(people);
  const atmRows = atmReportRows(people);
  const gcashRows = gcashReportRows(people);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    buildPayrollReportSheet({ client, payOut, stores, half }),
    "PAYROLL REPORT"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildSummarySheet({
      title,
      payOut,
      stores,
      people,
      grossAmount: input.gross_amount,
    }),
    "SUMMARY"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildAtmPayrollSheet({ payOut, savings, rows: atmRows }),
    "ATM PAYROLL"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildGcashPayrollSheet({ payOut, rows: gcashRows }),
    "GCASH PAYROLL"
  );

  return XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  }) as Buffer;
}

/** Map a posted register line + Directory pay fields → debit-memo person. */
export function disbursementPersonFromRegisterLine(input: {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  hire_date?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  net_pay?: number | null;
  gross_pay?: number | null;
  daily_rate?: number | null;
  rh_worked?: number | null;
  department?: string | null;
  client_name?: string | null;
  earnings?: Record<string, unknown> | null;
  deductions?: Record<string, unknown> | null;
}): DisbursementPerson {
  const e = input.earnings ?? {};
  const d = input.deductions ?? {};
  return {
    employee_code: input.employee_code,
    last_name: input.last_name,
    first_name: input.first_name,
    middle_name: input.middle_name,
    hire_date: input.hire_date,
    bank_account_no: input.bank_account_no,
    gcash: input.gcash,
    pay_through: input.pay_through,
    net_pay: input.net_pay,
    gross_pay: input.gross_pay,
    daily_rate: input.daily_rate,
    rh_worked: input.rh_worked,
    department: input.department,
    client_name: input.client_name,
    meal: n(e.meal),
    sil_adj: n(e.sil_cutoff ?? e.sil_adj ?? e.sil),
    allowance: n(e.allowance),
    thirteenth_month: n(e.thirteenth_month ?? e.thirteenmonth),
    sss_ee: n(d.sss),
    hdmf_ee: n(d.pagibig),
    phic_ee: n(d.philhealth),
    sss_er: n(d.sss_er),
    sss_provident_er: n(d.sss_wisp_er),
    sss_ecc: n(d.sss_ecc),
    hdmf_er: n(d.pagibig_er),
    phic_er: n(d.philhealth_er),
  };
}

export function debitMemoFilename(
  clientLabel: string,
  periodLabel: string
): string {
  const c = text(clientLabel).replace(/\s+/g, "-") || "Client";
  const p = text(periodLabel).replace(/\s+/g, "-") || "period";
  return `Debit-Memo-${c}-${p}.xlsx`;
}
