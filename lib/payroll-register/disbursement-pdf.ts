/**
 * PDF twins for Debit Memo (PAYROLL REPORT / SUMMARY / ATM / GCASH) and GCash upload.
 */

import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
import {
  createGpLandscapeReport,
  stampGpReportFooter,
  gpReportTableBottomMargin,
  GP_REPORT_GREEN,
} from "@/lib/reports/gp-report-pdf";
import { loadGpLogoDataUrl } from "@/lib/reports/gp-report-logo-node";
import {
  atmReportRows,
  gcashReportRows,
  payrollReportByStore,
  type DebitMemoPeriodHalf,
  type DisbursementPerson,
} from "./disbursement-debit-memo";
import { gcashUploadRows } from "./gcash-upload";

function peso(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const tableMargin = {
  left: 14,
  right: 14,
  top: 14,
  bottom: gpReportTableBottomMargin(14),
};

const gpTableStyles: Pick<
  UserOptions,
  "styles" | "headStyles" | "alternateRowStyles" | "footStyles" | "margin"
> = {
  margin: tableMargin,
  styles: {
    fontSize: 7,
    cellPadding: 1.6,
    textColor: [38, 50, 56],
    lineColor: [176, 190, 197],
    lineWidth: 0.1,
  },
  headStyles: {
    fillColor: GP_REPORT_GREEN,
    textColor: 255,
    fontStyle: "bold",
    fontSize: 7,
    halign: "center",
  },
  alternateRowStyles: { fillColor: [245, 247, 250] },
  footStyles: {
    fillColor: [232, 245, 233],
    textColor: [27, 94, 32],
    fontStyle: "bold",
    fontSize: 7,
  },
};

function sectionTitle(
  doc: {
    setFontSize: (n: number) => void;
    setFont: (n: string, s: string) => void;
    setTextColor: (...rgb: number[]) => void;
    text: (t: string, x: number, y: number) => void;
  },
  title: string,
  subtitle: string,
  y = 18
): number {
  doc.setTextColor(27, 94, 32);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  doc.setTextColor(55, 71, 79);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, y + 6);
  return y + 12;
}

export function buildDisbursementDebitMemoPdf(input: {
  client_name: string;
  title: string;
  pay_out_date: string;
  people: DisbursementPerson[];
  period_half?: DebitMemoPeriodHalf;
}): Uint8Array {
  void input.period_half;
  const logo = loadGpLogoDataUrl();
  const { doc, contentTop } = createGpLandscapeReport({
    title: "Debit Memo",
    subtitle: `${input.client_name} · ${input.title} · ${input.pay_out_date}`,
    logoDataUrl: logo,
  });

  const stores = payrollReportByStore(input.people);
  const storeNet = stores.reduce((a, s) => a + s.net, 0);
  autoTable(doc, {
    startY: contentTop,
    head: [
      [
        "Dept/Store",
        "ATM Pax",
        "ATM",
        "Cheque Pax",
        "Cheque",
        "GCash Pax",
        "GCash",
        "Hold",
        "Meal",
        "SIL/Adj",
        "Allow",
        "Pax",
        "Gross",
        "Net",
        "13th",
        "SSS EE",
        "HDMF EE",
        "PHIC EE",
      ],
    ],
    body: stores.map((s) => [
      s.department,
      s.atmPax,
      peso(s.atmNet),
      s.cashPax + s.chequePax,
      peso(s.cashNet + s.chequeNet),
      s.gcashPax,
      peso(s.gcashNet),
      peso(s.holdNet),
      peso(s.meal),
      peso(s.silAdj),
      peso(s.allowance),
      s.totalPax,
      peso(s.gross),
      peso(s.net),
      peso(s.thirteenthMonth),
      peso(s.sssEe),
      peso(s.hdmfEe),
      peso(s.phicEe),
    ]),
    foot: [
      [
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        peso(storeNet),
        "",
        "",
        "",
        "",
      ],
    ],
    showFoot: "lastPage",
    ...gpTableStyles,
    styles: { ...gpTableStyles.styles, fontSize: 6 },
    headStyles: { ...gpTableStyles.headStyles, fontSize: 5.5 },
  });

  // SUMMARY page
  doc.addPage();
  let y = sectionTitle(doc, "Payroll Summary", input.title);
  const atmTotal = stores.reduce((a, s) => a + s.atmNet, 0);
  const chequeTotal = stores.reduce(
    (a, s) => a + s.chequeNet + s.cashNet,
    0
  );
  const gcashTotal = stores.reduce((a, s) => a + s.gcashNet, 0);
  const holdTotal = stores.reduce((a, s) => a + s.holdNet, 0);
  autoTable(doc, {
    startY: y,
    head: [["Channel", "Amount"]],
    body: [
      ["ATM PAYROLL", peso(atmTotal)],
      ["CHEQUE PAYROLL", peso(chequeTotal)],
      ["GCASH PAYROLL", peso(gcashTotal)],
      ["HOLD", peso(holdTotal)],
    ],
    foot: [
      [
        "GRAND TOTAL",
        peso(atmTotal + chequeTotal + gcashTotal + holdTotal),
      ],
    ],
    showFoot: "lastPage",
    ...gpTableStyles,
  });

  const atmRows = atmReportRows(input.people);
  const atmSum = atmRows.reduce((a, r) => a + r.amount, 0);
  doc.addPage();
  y = sectionTitle(doc, "ATM Payroll", input.pay_out_date);
  autoTable(doc, {
    startY: y,
    head: [
      ["No.", "Account No.", "Amount", "Name", "Daily Rate", "RH", "Dept/Store"],
    ],
    body: atmRows.map((r, i) => [
      i + 1,
      r.accountNo,
      peso(r.amount),
      r.name,
      peso(r.dailyRate),
      r.rhWorked,
      r.deptStore,
    ]),
    foot: [["", "TOTAL", peso(atmSum), String(atmRows.length), "", "", ""]],
    showFoot: "lastPage",
    ...gpTableStyles,
  });

  const gcashRows = gcashReportRows(input.people);
  const gcashSum = gcashRows.reduce((a, r) => a + r.amount, 0);
  doc.addPage();
  y = sectionTitle(doc, "GCash Payroll", input.pay_out_date);
  autoTable(doc, {
    startY: y,
    head: [
      ["No.", "Mobile", "Name", "Amount", "Daily Rate", "RH", "Branch"],
    ],
    body: gcashRows.map((r, i) => [
      i + 1,
      r.mobile,
      r.name,
      peso(r.amount),
      peso(r.dailyRate),
      r.rhWorked,
      r.deptStore,
    ]),
    foot: [["", "", "TOTAL", peso(gcashSum), "", "", ""]],
    showFoot: "lastPage",
    ...gpTableStyles,
  });

  stampGpReportFooter(doc);
  return new Uint8Array(doc.output("arraybuffer"));
}

export function buildGcashUploadPdf(input: {
  pay_out_date: string;
  people: DisbursementPerson[];
  client_name?: string;
}): Uint8Array {
  const rows = gcashUploadRows(input.people, input.client_name);
  const { doc, contentTop } = createGpLandscapeReport({
    title: "GCash for uploading",
    subtitle: input.pay_out_date,
    logoDataUrl: loadGpLogoDataUrl(),
  });

  const total = rows.reduce((a, r) => a + r.amount, 0);
  autoTable(doc, {
    startY: contentTop,
    head: [
      ["No.", "Client", "Department", "Mobile", "Name", "Amount", "Charges"],
    ],
    body: rows.map((r) => [
      r.no,
      r.client,
      r.department,
      r.mobile,
      r.name,
      peso(r.amount),
      r.charges,
    ]),
    foot: [["", "", "", "", "TOTAL", peso(total), ""]],
    showFoot: "lastPage",
    ...gpTableStyles,
    styles: { ...gpTableStyles.styles, fontSize: 8 },
    headStyles: { ...gpTableStyles.headStyles, fontSize: 8 },
  });

  stampGpReportFooter(doc);
  return new Uint8Array(doc.output("arraybuffer"));
}

export function debitMemoPdfFilename(
  clientLabel: string,
  periodLabel: string
): string {
  const c = String(clientLabel ?? "")
    .trim()
    .replace(/\s+/g, "-") || "Client";
  const p = String(periodLabel ?? "")
    .trim()
    .replace(/\s+/g, "-") || "period";
  return `Debit-Memo-${c}-${p}.pdf`;
}

export function gcashUploadPdfFilename(periodLabel: string): string {
  const p = String(periodLabel ?? "")
    .trim()
    .replace(/\s+/g, "-") || "period";
  return `GCASH-FOR-UPLOADING-${p}.pdf`;
}
