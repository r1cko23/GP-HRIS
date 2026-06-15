import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";

function safeNumber(n: unknown): number {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export type GpPayrollRegisterTable = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  totalsRow: (string | number)[];
  columnWidths: number[];
};

type SlipInput = {
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  adjustment_amount?: number | null;
  sss_amount?: number | null;
  philhealth_amount?: number | null;
  pagibig_amount?: number | null;
  deductions_breakdown?: Record<string, unknown> | null;
  employees?: {
    employee_id?: string | null;
    full_name?: string | null;
    position?: string | null;
  } | null;
};

function loanTotalFromBreakdown(ded: Record<string, unknown> | null | undefined): number {
  const weekly =
    ded?.weekly && typeof ded.weekly === "object"
      ? (ded.weekly as Record<string, unknown>)
      : null;
  if (!weekly) return 0;
  const monthlyLoans =
    weekly.monthly_loans && typeof weekly.monthly_loans === "object"
      ? (weekly.monthly_loans as Record<string, unknown>)
      : null;
  const parts = [
    weekly.sss_loan,
    weekly.sss_calamity,
    weekly.pagibig_loan,
    weekly.pagibig_calamity,
    monthlyLoans?.sssLoan,
    monthlyLoans?.pagibigLoan,
    monthlyLoans?.companyLoan,
    monthlyLoans?.emergencyLoan,
    monthlyLoans?.otherLoan,
  ];
  return parts.reduce<number>((sum, v) => sum + safeNumber(v), 0);
}

function valeFromBreakdown(ded: Record<string, unknown> | null | undefined): number {
  const weekly =
    ded?.weekly && typeof ded.weekly === "object"
      ? (ded.weekly as Record<string, unknown>)
      : null;
  return safeNumber(weekly?.vale);
}

function taxFromSlip(slip: SlipInput): number {
  const ded = slip.deductions_breakdown;
  if (ded && typeof ded.tax === "number") return safeNumber(ded.tax);
  if (ded && typeof ded.withholding_tax === "number") {
    return safeNumber(ded.withholding_tax);
  }
  return 0;
}

export function buildGpPayrollRegisterTable(params: {
  cutoffStart: string;
  cutoffEnd: string;
  companyName?: string;
  slips: SlipInput[];
}): GpPayrollRegisterTable {
  const title = params.companyName || "GREEN PASTURE PEOPLE MANAGEMENT INC.";
  const subtitle = `Payroll Register — ${formatBiMonthlyPeriod(
    new Date(params.cutoffStart),
    new Date(params.cutoffEnd)
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

  const rows = params.slips.map((slip, index) => {
    const ded = slip.deductions_breakdown;
    const sss = safeNumber(slip.sss_amount);
    const philhealth = safeNumber(slip.philhealth_amount);
    const pagibig = safeNumber(slip.pagibig_amount);
    const tax = taxFromSlip(slip);
    const vale = valeFromBreakdown(ded);
    const loans = loanTotalFromBreakdown(ded);
    const adjustment = safeNumber(slip.adjustment_amount);
    const gross = safeNumber(slip.gross_pay);
    const totalDed = safeNumber(slip.total_deductions);
    const net = safeNumber(slip.net_pay);

    totals.gross += gross;
    totals.sss += sss;
    totals.philhealth += philhealth;
    totals.pagibig += pagibig;
    totals.tax += tax;
    totals.vale += vale;
    totals.loans += loans;
    totals.adjustment += adjustment;
    totals.deductions += totalDed;
    totals.net += net;

    return [
      index + 1,
      slip.employees?.employee_id || "",
      slip.employees?.full_name || "",
      slip.employees?.position || "",
      gross,
      sss,
      philhealth,
      pagibig,
      tax,
      vale,
      loans,
      adjustment,
      totalDed,
      net,
    ];
  });

  const totalsRow = [
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

  return {
    title,
    subtitle,
    headers,
    rows,
    totalsRow,
    columnWidths,
  };
}
