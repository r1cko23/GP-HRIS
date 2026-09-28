/**
 * 13th-month accrual from posted register basic pay (MAIN thirteenmonth grain, compute only).
 * Accrual = basic / 12 per cutoff; YTD = sum of accruals in the Client year window.
 */

import XLSX from "xlsx-js-style";
import autoTable from "jspdf-autotable";
import {
  createGpLandscapeReport,
  stampGpReportFooter,
  gpReportTableBottomMargin,
  GP_REPORT_GREEN,
} from "@/lib/reports/gp-report-pdf";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Accrue 1/12 of basic for one posted cutoff line. */
export function thirteenthMonthAccrual(basicPay: unknown): number {
  const basic = n(basicPay);
  if (basic <= 0) return 0;
  return round2(basic / 12);
}

export type ThirteenthMonthLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  directory_employee_id?: string | null;
  basic_pay?: number | null;
  accrual?: number | null;
  period_start?: string | null;
  period_end?: string | null;
};

export type ThirteenthMonthYtdRow = {
  directory_employee_id: string | null;
  employee_code: string;
  last_name: string;
  first_name: string;
  cutoff_count: number;
  ytd_basic: number;
  ytd_accrual: number;
};

/** Roll posted cutoff accruals into per-person YTD. */
export function rollThirteenthMonthYtd(
  lines: ThirteenthMonthLine[]
): ThirteenthMonthYtdRow[] {
  const byKey = new Map<string, ThirteenthMonthYtdRow>();
  for (const line of lines) {
    const dirId = text(line.directory_employee_id) || null;
    const code = text(line.employee_code);
    const key = dirId || `code:${code}` || `name:${text(line.last_name)}:${text(line.first_name)}`;
    if (!key || key === "code:" || key.startsWith("name::")) continue;
    const basic = n(line.basic_pay);
    const accrual =
      line.accrual != null && Number.isFinite(Number(line.accrual))
        ? n(line.accrual)
        : thirteenthMonthAccrual(basic);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        directory_employee_id: dirId,
        employee_code: code,
        last_name: text(line.last_name),
        first_name: text(line.first_name),
        cutoff_count: 1,
        ytd_basic: round2(basic),
        ytd_accrual: round2(accrual),
      });
      continue;
    }
    existing.cutoff_count += 1;
    existing.ytd_basic = round2(existing.ytd_basic + basic);
    existing.ytd_accrual = round2(existing.ytd_accrual + accrual);
    if (!existing.employee_code && code) existing.employee_code = code;
    if (!existing.last_name) existing.last_name = text(line.last_name);
    if (!existing.first_name) existing.first_name = text(line.first_name);
  }
  return [...byKey.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  );
}

export const THIRTEENTH_MONTH_HEADERS = [
  "Employee code",
  "Last name",
  "First name",
  "Cutoff count",
  "YTD basic",
  "YTD 13th month accrual",
] as const;

export function thirteenthMonthRowValues(row: ThirteenthMonthYtdRow): unknown[] {
  return [
    row.employee_code,
    row.last_name,
    row.first_name,
    row.cutoff_count,
    row.ytd_basic,
    row.ytd_accrual,
  ];
}

/** Miss Merry validated sheet: CLIENT | NAME | 13TH MONTH | YTD | PAYOUT */

export type MissMerryPersonSource = ThirteenthMonthYtdRow & {
  client_name?: string | null;
  middle_name?: string | null;
  payout?: string | null;
};

export type MissMerryPersonRow = {
  client: string;
  name: string;
  thirteenth_month: number;
  ytd: number;
  payout: string;
};

export const MISS_MERRY_PERSON_HEADERS = [
  "CLIENT",
  "NAME",
  "13TH MONTH",
  "YTD",
  "PAYOUT",
] as const;

export function formatMissMerryName(
  lastName: string | null | undefined,
  firstName: string | null | undefined,
  middleName?: string | null
): string {
  const last = text(lastName).toUpperCase();
  const first = text(firstName).toUpperCase();
  const mid = text(middleName).toUpperCase();
  if (!last && !first) return "";
  if (!last) return mid ? `${first} ${mid}` : first;
  if (!first) return last;
  return mid ? `${last}, ${first} ${mid}` : `${last}, ${first}`;
}

export function toMissMerryPersonRows(
  rows: MissMerryPersonSource[]
): MissMerryPersonRow[] {
  return rows.map((row) => {
    const ytdBasic = round2(n(row.ytd_basic));
    const thirteenth =
      row.ytd_accrual != null && Number.isFinite(Number(row.ytd_accrual))
        ? round2(n(row.ytd_accrual))
        : round2(ytdBasic / 12);
    // Validate sheet: YTD column is Excel formula C×12 (annualize 13th month).
    const ytd = round2(thirteenth * 12);
    return {
      client: text(row.client_name).toUpperCase() || "—",
      name: formatMissMerryName(row.last_name, row.first_name, row.middle_name),
      thirteenth_month: thirteenth,
      ytd,
      payout: text(row.payout),
    };
  });
}

export function missMerryPersonRowValues(row: MissMerryPersonRow): unknown[] {
  return [row.client, row.name, row.thirteenth_month, row.ytd, row.payout];
}

/** Salary-range headcount bands on 13th-month amount (Miss Merry REPORTS DETAILS). */
export const MISS_MERRY_SALARY_RANGE_DEFS = [
  { range: "LESS 5000", min: 0, max: 5000 },
  { range: "PHP5,001-10,000", min: 5000.01, max: 10000 },
  { range: "PHP10,001-20,000", min: 10000.01, max: 20000 },
  { range: "PHP20,001-30,000", min: 20000.01, max: 30000 },
  { range: "PHP30,001-40,000", min: 30000.01, max: 40000 },
  { range: "PHP40,001-50,000", min: 40000.01, max: 50000 },
  { range: "PHP50,001-60,000", min: 50000.01, max: 60000 },
  { range: "PHP60,001-70,000", min: 60000.01, max: 70000 },
  { range: "PHP70,001-80,000", min: 70000.01, max: 80000 },
  { range: "PHP80,001-90,000", min: 80000.01, max: 90000 },
  { range: "PHP90,001-100,000", min: 90000.01, max: 100000 },
  { range: ">PHP100,000", min: 100000.01, max: Number.POSITIVE_INFINITY },
] as const;

export type MissMerrySalaryRangeRow = {
  range: string;
  head_count: number;
};

export function countMissMerrySalaryRanges(
  thirteenthAmounts: number[]
): MissMerrySalaryRangeRow[] {
  const bands = MISS_MERRY_SALARY_RANGE_DEFS.map((def) => ({
    range: def.range,
    head_count: 0,
  }));
  let total = 0;
  for (const raw of thirteenthAmounts) {
    const amount = n(raw);
    if (!(amount > 0)) continue;
    total += 1;
    const idx = MISS_MERRY_SALARY_RANGE_DEFS.findIndex(
      (def) => amount >= def.min && amount <= def.max
    );
    if (idx >= 0) bands[idx].head_count += 1;
  }
  return [...bands, { range: "GRAND TOTAL", head_count: total }];
}

/** MAIN "13th month Final Pay" layout. */

/** Active / Inactive / All — Directory employment status for Final Pay filter. */
export function matchesFinalPayStatusFilter(
  employeeStatus: string | null | undefined,
  filterLabel: string | null | undefined
): boolean {
  const filter = text(filterLabel).toLowerCase();
  if (!filter || filter === "all") return true;
  const status = text(employeeStatus).toLowerCase();
  if (filter === "active") return status === "active";
  if (filter === "inactive") {
    return (
      status === "inactive" ||
      status === "for_release" ||
      status === "barred"
    );
  }
  return true;
}

export type FinalPaySource = ThirteenthMonthYtdRow & {
  middle_name?: string | null;
};

export type FinalPayRow = {
  emp_id: string;
  full_name: string;
  no_of_months: number;
  total_basic: number;
  thirteenth_month_pay: number;
};

export const FINAL_PAY_HEADERS = [
  "Emp ID",
  "Full Name",
  "No of Months",
  "Total Basic",
  "13th Month Pay",
] as const;

/** Bi-monthly cutoffs → months (21 cutoffs → 10.50). */
export function finalPayNoOfMonths(cutoffCount: number): number {
  const count = n(cutoffCount);
  if (count <= 0) return 0;
  return round2(count / 2);
}

export function formatFinalPayFullName(
  lastName: string | null | undefined,
  firstName: string | null | undefined,
  middleName?: string | null
): string {
  const last = text(lastName).toUpperCase();
  const first = text(firstName).toUpperCase();
  let mid = text(middleName).toUpperCase();
  if (mid && !mid.endsWith(".")) {
    mid = mid.length === 1 ? `${mid}.` : `${mid.charAt(0)}.`;
  }
  return [last, first, mid].filter(Boolean).join(" ");
}

export function toFinalPayRows(rows: FinalPaySource[]): FinalPayRow[] {
  return rows.map((row) => {
    const totalBasic = round2(n(row.ytd_basic));
    const thirteenth =
      row.ytd_accrual != null && Number.isFinite(Number(row.ytd_accrual))
        ? round2(n(row.ytd_accrual))
        : round2(totalBasic / 12);
    return {
      emp_id: text(row.employee_code),
      full_name: formatFinalPayFullName(
        row.last_name,
        row.first_name,
        row.middle_name
      ),
      no_of_months: finalPayNoOfMonths(row.cutoff_count),
      total_basic: totalBasic,
      thirteenth_month_pay: thirteenth,
    };
  });
}

export function finalPayRowValues(row: FinalPayRow): unknown[] {
  return [
    row.emp_id,
    row.full_name,
    row.no_of_months,
    row.total_basic,
    row.thirteenth_month_pay,
  ];
}

function formatFinalPayDate(value: string | null | undefined): string {
  const raw = text(value);
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return raw;
}

function csvEscapeFinal(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildFinalPayCsv(
  rows: FinalPayRow[],
  opts: {
    clientName?: string | null;
    status?: string | null;
    periodFrom?: string | null;
    periodTo?: string | null;
  } = {}
): string {
  const client = text(opts.clientName);
  const status = text(opts.status) || "Active";
  const totalBasic = round2(rows.reduce((sum, r) => sum + r.total_basic, 0));
  const total13th = round2(
    rows.reduce((sum, r) => sum + r.thirteenth_month_pay, 0)
  );
  const lines = [
    `Client: ${client} | Status :${status}`,
    `Period: ${formatFinalPayDate(opts.periodFrom) || "—"} to ${
      formatFinalPayDate(opts.periodTo) || "—"
    }`,
    "",
    FINAL_PAY_HEADERS.join(","),
    ...rows.map((row) =>
      finalPayRowValues(row)
        .map((cell) => csvEscapeFinal(cell as string | number))
        .join(",")
    ),
    `Total:,${csvEscapeFinal(totalBasic)},${csvEscapeFinal(total13th)}`,
  ];
  return `${lines.join("\n")}\n`;
}

/** Miss Merry validate workbook: REPORTS DETAILS + employee list. */

export type MissMerryValidatedExportInput = {
  year: number;
  clientName?: string | null;
  salaryRanges: MissMerrySalaryRangeRow[];
  people: MissMerryPersonRow[];
  logoDataUrl?: string | null;
};

export function buildMissMerryValidatedWorkbook(
  input: MissMerryValidatedExportInput
): Buffer {
  const wb = XLSX.utils.book_new();

  const detailsAoa: unknown[][] = [
    ["NO. OF WORKERS & SALARY RANGE"],
    [],
    ["RANGE", "HEAD COUNTS"],
    ...input.salaryRanges.map((row) => [row.range, row.head_count]),
  ];
  const detailsWs = XLSX.utils.aoa_to_sheet(detailsAoa);
  XLSX.utils.book_append_sheet(wb, detailsWs, "REPORTS DETAILS");

  const peopleAoa: unknown[][] = [
    [...MISS_MERRY_PERSON_HEADERS],
    ...input.people.map((row) => [
      row.client,
      row.name,
      row.thirteenth_month,
      null, // YTD filled as C×12 formula below (validate sheet)
      row.payout,
    ]),
  ];
  const peopleWs = XLSX.utils.aoa_to_sheet(peopleAoa);
  const moneyFmt = "#,##0.00";
  for (let i = 0; i < input.people.length; i++) {
    const excelRow = i + 2; // 1-indexed; row 1 is header
    const person = input.people[i]!;
    const cAddr = `C${excelRow}`;
    const dAddr = `D${excelRow}`;
    peopleWs[cAddr] = {
      t: "n",
      v: person.thirteenth_month,
      z: moneyFmt,
    };
    peopleWs[dAddr] = {
      t: "n",
      v: person.ytd,
      f: `C${excelRow}*12`,
      z: moneyFmt,
    };
  }
  peopleWs["!cols"] = [
    { wch: 28 },
    { wch: 36 },
    { wch: 14 },
    { wch: 14 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, peopleWs, "13TH MONTH PAY-VALIDATED");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildMissMerryValidatedPdf(
  input: MissMerryValidatedExportInput
): Buffer {
  const client = text(input.clientName);
  const { doc, contentTop, margin } = createGpLandscapeReport({
    title: "13TH MONTH PAY-VALIDATED",
    subtitle: `${input.year}${client ? ` · ${client}` : ""}`,
    logoDataUrl: input.logoDataUrl ?? null,
  });

  const tableMargin = {
    left: margin,
    right: margin,
    top: margin,
    bottom: gpReportTableBottomMargin(margin),
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NO. OF WORKERS & SALARY RANGE", margin, contentTop);

  autoTable(doc, {
    startY: contentTop + 4,
    head: [["RANGE", "HEAD COUNTS"]],
    body: input.salaryRanges.map((row) => [row.range, String(row.head_count)]),
    margin: tableMargin,
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
    },
  });

  const afterDetails =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? contentTop + 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("13TH MONTH PAY-VALIDATED", margin, afterDetails + 10);

  autoTable(doc, {
    startY: afterDetails + 14,
    head: [[...MISS_MERRY_PERSON_HEADERS]],
    body: input.people.map((row) =>
      missMerryPersonRowValues(row).map((cell) =>
        typeof cell === "number"
          ? cell.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : String(cell ?? "")
      )
    ),
    margin: tableMargin,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  stampGpReportFooter(doc, margin);
  return Buffer.from(doc.output("arraybuffer"));
}

export function missMerryValidatedFilename(
  year: number,
  clientName?: string | null
): string {
  const client = text(clientName).replace(/\s+/g, "-");
  return `13th-month-pay-validated-${year}${client ? `-${client}` : ""}`;
}

/** Final Pay Excel + PDF (MAIN layout). */

export type FinalPayExportInput = {
  rows: FinalPayRow[];
  clientName?: string | null;
  status?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  logoDataUrl?: string | null;
};

export function buildFinalPayWorkbook(input: FinalPayExportInput): Buffer {
  const client = text(input.clientName);
  const status = text(input.status) || "Active";
  const totalBasic = round2(
    input.rows.reduce((sum, r) => sum + r.total_basic, 0)
  );
  const total13th = round2(
    input.rows.reduce((sum, r) => sum + r.thirteenth_month_pay, 0)
  );
  const aoa: unknown[][] = [
    [`Client: ${client} | Status :${status}`],
    [
      `Period: ${formatFinalPayDate(input.periodFrom) || "—"} to ${
        formatFinalPayDate(input.periodTo) || "—"
      }`,
    ],
    [],
    [...FINAL_PAY_HEADERS],
    ...input.rows.map(finalPayRowValues),
    ["Total:", "", "", totalBasic, total13th],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Final Pay");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildFinalPayPdf(input: FinalPayExportInput): Buffer {
  const client = text(input.clientName);
  const status = text(input.status) || "Active";
  const totalBasic = round2(
    input.rows.reduce((sum, r) => sum + r.total_basic, 0)
  );
  const total13th = round2(
    input.rows.reduce((sum, r) => sum + r.thirteenth_month_pay, 0)
  );
  const { doc, contentTop, margin } = createGpLandscapeReport({
    title: "13th month Final Pay",
    subtitle: `Client: ${client} | Status :${status}`,
    logoDataUrl: input.logoDataUrl ?? null,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Period: ${formatFinalPayDate(input.periodFrom) || "—"} to ${
      formatFinalPayDate(input.periodTo) || "—"
    }`,
    margin,
    contentTop
  );

  const money = (v: number) =>
    v.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  autoTable(doc, {
    startY: contentTop + 6,
    head: [[...FINAL_PAY_HEADERS]],
    body: input.rows.map((row) => [
      row.emp_id,
      row.full_name,
      row.no_of_months.toFixed(2),
      money(row.total_basic),
      money(row.thirteenth_month_pay),
    ]),
    foot: [["Total:", "", "", money(totalBasic), money(total13th)]],
    showFoot: "lastPage",
    margin: {
      left: margin,
      right: margin,
      top: margin,
      bottom: gpReportTableBottomMargin(margin),
    },
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: {
      fillColor: GP_REPORT_GREEN,
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [232, 245, 233],
      textColor: [27, 94, 32],
      fontStyle: "bold",
    },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  stampGpReportFooter(doc, margin);
  return Buffer.from(doc.output("arraybuffer"));
}

export function finalPayExportFilename(opts: {
  periodFrom?: string | null;
  periodTo?: string | null;
  clientName?: string | null;
}): string {
  const from = text(opts.periodFrom) || "all";
  const to = text(opts.periodTo) || "all";
  const client = text(opts.clientName).replace(/\s+/g, "-");
  return `13th-month-final-pay-${from}-${to}${client ? `-${client}` : ""}`;
}
