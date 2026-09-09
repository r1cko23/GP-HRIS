/**
 * Individual Organic payslip PDF from a payroll_register_lines row.
 * Print-oriented A4 layout for HR distribution and employee records.
 */

import jsPDF from "jspdf";
import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import {
  formatPayslipPhp,
  labelizePayslipKey,
  organicPayslipView,
} from "@/lib/payroll-register/organic-payslip-view";

export type OrganicPayslipLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  hours?: Record<string, number> | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
};

function drawRow(
  doc: jsPDF,
  y: number,
  left: number,
  width: number,
  label: string,
  value: string,
  opts?: { bold?: boolean; fill?: [number, number, number] }
) {
  if (opts?.fill) {
    doc.setFillColor(...opts.fill);
    doc.rect(left, y - 3.5, width, 6, "F");
  }
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  const valueX = left + width - 1.5;
  const valueW = doc.getTextWidth(value);
  const maxLabelW = Math.max(18, width - valueW - 6);
  const fitted = doc.splitTextToSize(label, maxLabelW);
  const shown = Array.isArray(fitted) ? fitted[0] : fitted;
  doc.text(shown, left + 1.5, y);
  doc.text(value, valueX, y, { align: "right" });
  return y + 6;
}

export function generateOrganicPayslipPDF(input: {
  periodStart: string;
  periodEnd: string;
  payrollDate?: string | null;
  companyName?: string;
  preparedBy?: string | null;
  line: OrganicPayslipLine;
}): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const company =
    input.companyName || "GREEN PASTURE PEOPLE MANAGEMENT INC.";
  const name = [input.line.last_name, input.line.first_name]
    .filter(Boolean)
    .join(", ");
  const periodLabel = formatBiMonthlyPeriod(
    new Date(input.periodStart),
    new Date(input.periodEnd)
  );
  const view = organicPayslipView(input.line);
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;

  // Brand header bar
  doc.setFillColor(30, 95, 52);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(company, margin, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Employee Payslip · Confidential", margin, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PAYSLIP", pageW - margin, 12, { align: "right" });

  let y = 30;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Pay period", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(periodLabel, margin + 28, y);
  y += 5;
  if (input.payrollDate) {
    doc.setFont("helvetica", "bold");
    doc.text("Payroll date", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(input.payrollDate, margin + 28, y);
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Generated", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "MMM d, yyyy h:mm a"), margin + 28, y);

  // Employee card
  y += 8;
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(248, 249, 247);
  doc.roundedRect(margin, y, contentW, 28, 1.5, 1.5, "FD");
  const cardY = y + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(name || "—", margin + 3, cardY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Employee ID: ${input.line.employee_code ?? "—"}`, margin + 3, cardY + 6);
  doc.text(
    `Daily rate: ${formatPayslipPhp(input.line.daily_rate)}`,
    margin + 3,
    cardY + 12
  );
  doc.text(
    `Monthly salary: ${formatPayslipPhp(input.line.monthly_salary)}`,
    margin + contentW / 2,
    cardY + 12
  );
  if (input.line.bank_name || input.line.bank_account_no) {
    doc.text(
      `Bank: ${input.line.bank_name ?? "—"}  ·  ${input.line.bank_account_no ?? "—"}`,
      margin + 3,
      cardY + 18
    );
  }
  if (view.daysWork > 0) {
    doc.text(
      `Days worked: ${view.daysWork.toLocaleString("en-PH", {
        maximumFractionDigits: 2,
      })}`,
      margin + contentW / 2,
      cardY + 18
    );
  }
  y += 34;

  // Two columns: earnings/hours | deductions
  const colGap = 4;
  const colW = (contentW - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;
  let leftY = y;
  let rightY = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(30, 95, 52);
  doc.setTextColor(255, 255, 255);
  doc.rect(leftX, leftY, colW, 6.5, "F");
  doc.text("EARNINGS", leftX + 2, leftY + 4.5);
  leftY += 9;
  doc.setTextColor(30, 30, 30);

  for (const [key, amount] of view.earningRows) {
    leftY = drawRow(
      doc,
      leftY,
      leftX,
      colW,
      labelizePayslipKey(key),
      formatPayslipPhp(amount)
    );
  }
  leftY = drawRow(
    doc,
    leftY + 1,
    leftX,
    colW,
    "Gross pay",
    formatPayslipPhp(input.line.gross_pay),
    { bold: true, fill: [232, 245, 233] }
  );

  leftY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(66, 66, 66);
  doc.setTextColor(255, 255, 255);
  doc.rect(leftX, leftY, colW, 6.5, "F");
  doc.text("HOURS", leftX + 2, leftY + 4.5);
  leftY += 9;
  doc.setTextColor(30, 30, 30);
  if (view.hourRows.length === 0) {
    leftY = drawRow(doc, leftY, leftX, colW, "No hour detail", "—");
  } else {
    for (const [key, value] of view.hourRows) {
      leftY = drawRow(
        doc,
        leftY,
        leftX,
        colW,
        labelizePayslipKey(key),
        value.toLocaleString("en-PH", { maximumFractionDigits: 2 })
      );
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(30, 95, 52);
  doc.setTextColor(255, 255, 255);
  doc.rect(rightX, rightY, colW, 6.5, "F");
  doc.text("DEDUCTIONS", rightX + 2, rightY + 4.5);
  rightY += 9;
  doc.setTextColor(30, 30, 30);

  if (
    view.primaryDeductionRows.length === 0 &&
    view.extraDeductionRows.length === 0
  ) {
    rightY = drawRow(doc, rightY, rightX, colW, "No deductions", "—");
  }
  for (const [label, amount] of view.primaryDeductionRows) {
    rightY = drawRow(
      doc,
      rightY,
      rightX,
      colW,
      label,
      formatPayslipPhp(amount)
    );
  }
  for (const [key, amount] of view.extraDeductionRows) {
    rightY = drawRow(
      doc,
      rightY,
      rightX,
      colW,
      labelizePayslipKey(key),
      formatPayslipPhp(amount)
    );
  }
  rightY = drawRow(
    doc,
    rightY + 1,
    rightX,
    colW,
    "Total deductions",
    formatPayslipPhp(input.line.total_deductions),
    { bold: true, fill: [255, 243, 224] }
  );

  // Net pay bar
  const footerY = Math.max(leftY, rightY) + 8;
  doc.setFillColor(30, 95, 52);
  doc.roundedRect(margin, footerY, contentW, 14, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NET PAY", margin + 4, footerY + 9);
  doc.setFontSize(13);
  doc.text(formatPayslipPhp(input.line.net_pay), pageW - margin - 4, footerY + 9, {
    align: "right",
  });

  // Signature / acknowledgment
  let sigY = footerY + 24;
  doc.setTextColor(90, 90, 90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "This payslip is computer-generated from the approved payroll register. Keep for your records.",
    margin,
    sigY
  );
  sigY += 10;
  doc.setDrawColor(160, 160, 160);
  doc.line(margin, sigY, margin + 70, sigY);
  doc.line(pageW - margin - 70, sigY, pageW - margin, sigY);
  sigY += 4;
  doc.setFontSize(7.5);
  doc.text("Employee acknowledgment", margin, sigY);
  doc.text(
    input.preparedBy ? `Prepared by: ${input.preparedBy}` : "Prepared by / HR",
    pageW - margin - 70,
    sigY
  );

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${input.line.employee_code ?? "employee"} · ${input.periodStart}–${input.periodEnd}`,
    margin,
    290
  );
  doc.text("Page 1 of 1", pageW - margin, 290, { align: "right" });

  return doc;
}

export function organicPayslipFilename(
  line: OrganicPayslipLine,
  periodStart: string,
  periodEnd: string
): string {
  const code = (line.employee_code || "employee").replace(/[^\w.-]+/g, "_");
  return `payslip_${code}_${periodStart}_${periodEnd}.pdf`;
}
