/**
 * Build a printable payroll summary table from Organic register lines.
 */

import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export type RegisterSummaryLine = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
};

export function buildOrganicRegisterSummaryTable(params: {
  periodStart: string;
  periodEnd: string;
  companyName?: string;
  lines: RegisterSummaryLine[];
}): GpPayrollRegisterTable {
  const title = params.companyName || "GREEN PASTURE PEOPLE MANAGEMENT INC.";
  const subtitle = `Payroll Summary — ${formatBiMonthlyPeriod(
    new Date(params.periodStart),
    new Date(params.periodEnd)
  )} · Generated ${format(new Date(), "MMM d, yyyy")}`;

  const headers = [
    "#",
    "Employee ID",
    "Name",
    "Position",
    "Gross Pay",
    "SSS",
    "PhilHealth",
    "Pag-IBIG",
    "Withholding Tax",
    "Vale",
    "Loans",
    "Adjustment",
    "Total Deductions",
    "Net Pay",
  ];

  const columnWidths = [4, 12, 24, 16, 12, 10, 10, 10, 12, 10, 10, 10, 14, 12];

  let totals = {
    gross: 0,
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    tax: 0,
    vale: 0,
    loans: 0,
    adjustment: 0,
    deductions: 0,
    net: 0,
  };

  const rows = params.lines.map((line, index) => {
    const d = line.deductions ?? {};
    const sss = n(d.sss);
    const philhealth = n(d.philhealth);
    const pagibig = n(d.pagibig);
    const tax = n(d.withholding_tax);
    const vale = n(d.other);
    const loans = n(d.loans);
    const adjustment = n(line.earnings?.adjustment);
    const gross = n(line.gross_pay);
    const deductions = n(line.total_deductions);
    const net = n(line.net_pay);
    const name = [line.last_name, line.first_name].filter(Boolean).join(", ");

    totals.gross += gross;
    totals.sss += sss;
    totals.philhealth += philhealth;
    totals.pagibig += pagibig;
    totals.tax += tax;
    totals.vale += vale;
    totals.loans += loans;
    totals.adjustment += adjustment;
    totals.deductions += deductions;
    totals.net += net;

    return [
      index + 1,
      line.employee_code ?? "",
      name,
      "",
      gross,
      sss,
      philhealth,
      pagibig,
      tax,
      vale,
      loans,
      adjustment,
      deductions,
      net,
    ];
  });

  const totalsRow: (string | number)[] = [
    "",
    "",
    "TOTAL",
    "",
    totals.gross,
    totals.sss,
    totals.philhealth,
    totals.pagibig,
    totals.tax,
    totals.vale,
    totals.loans,
    totals.adjustment,
    totals.deductions,
    totals.net,
  ];

  return { title, subtitle, headers, rows, totalsRow, columnWidths };
}
