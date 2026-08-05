import { describe, expect, it } from "vitest";
import {
  resolveNabati28Layout,
  resolveExternalRegisterLayout,
} from "../register-columns";
import { parsePayrollRegisterText } from "../parse-payroll-register-pdf";
import { validateParsedRegisterMetrics } from "../validate-parsed-register";

/** June 1–15 2026 Nabati EDD Cavite totals (Salaries and Wages 187,848.72). */
const CAVITE_TOTALS = [
  11150, 1704, 213, 139865, 139865, 139, 13031.26, 4, 30, 128, 10455, 13.5,
  2632.5, 1, 15, 47983.72, 3695, 11050, 2074.96, 5000, 187848.72, 8200, 4250,
  3400, -1628.18, 14221.82, 173626.9, 11655.44,
];

const CAVITE_HEADERS = `
Daily Rate Hours Days Basic Total Salary Reg OT
Hours
Reg OT Amt NightDiff
Hours
NightDiff Amt Legal
Holiday
Hours
Legal
Holiday Amt
Legal
Holiday OT
Hours
Legal
Holiday OT
Amt
Legal
Holiday ND
Hours
Legal
Holiday ND
Amt
Total OT Service
Incentive
Leave
Meal
Allowance
COMM
Allowance
Gas & Motor Gross Amt SSS PHILHEALT
H
PagIbig SSS Loan Total
Deduction
Net Amount 13th Month
Cuttoff
`;

describe("resolveNabati28Layout — Legal Holiday + allowance pack", () => {
  it("anchors Cavite gross at index 20 from Salaries and Wages", () => {
    const text = `${CAVITE_HEADERS}\nSalaries and Wages: 187,848.72\nNABATI FOOD PHILIPPINES INC.`;
    const layout = resolveNabati28Layout(text, CAVITE_TOTALS, true);
    expect(layout.grossAmount).toBe(20);
    expect(layout.hoursWorked).toBe(1);
    expect(layout.totalOTAmount).toBe(15);
    expect(layout.netAmount).toBe(26);
    expect(layout.sssLoan ?? layout.otherDeduction).toBe(24);
    expect(CAVITE_TOTALS[layout.grossAmount!]).toBeCloseTo(187848.72, 2);
  });

  it("detects packs without Other Deduction (net closer to gross)", () => {
    // SSS+PH+PagIbig = Total Ded @gross+4, Net @gross+5
    const nums = [
      5560, 705.06, 88.13, 61252.09, 61252.09, 243, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      48817.45, 695, 4743.58, 1207.89, 5242.56, 110069.54, 5100, 2000, 1600, 8700,
      101369.54, 5104.35, 978.43,
    ];
    const text = `Gas & Motor Gross Amt SSS PHILHEALT H PagIbig Total Deduction Net Amount\nSalaries and Wages: 110,069.54\nNABATI FOOD`;
    const layout = resolveNabati28Layout(text, nums, true);
    expect(layout.grossAmount).toBe(20);
    expect(layout.otherDeduction ?? layout.sssLoan).toBeUndefined();
    expect(layout.totalDeduction).toBe(24);
    expect(layout.netAmount).toBe(25);
    expect(layout.hoursWorked).toBe(1);
  });

  it("wins over Converge tail when resolving external layout", () => {
    const text = `${CAVITE_HEADERS}\nSalaries and Wages: 187,848.72\nNABATI FOOD\nGas & Motor`;
    const layout = resolveExternalRegisterLayout(28, text, CAVITE_TOTALS, {
      isTotalRow: true,
    });
    expect(layout?.grossAmount).toBe(20);
    expect(layout?.grossAmount).not.toBe(26);
    expect(layout?.grossAmount).not.toBe(27);
    expect(layout?.hoursWorked).toBe(1);
  });
});

describe("Nabati EDD Cavite parse", () => {
  it("ties employee gross to Salaries and Wages", () => {
    const text = `
${CAVITE_HEADERS}
Total ${CAVITE_TOTALS.map((n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })).join(" ")}
1. BONILLA, ANNIE A. 600.00 96.00 12.00 7,200.00 7,200.00 17.50 1,640.63 - - 8.00 600.00 1.00 195.00 - - 4,106.39 600.00 840.00 230.76 - 11,306.39 475.00 250.00 200.00 - 925.00 10,381.39 600.00
2. CARABEO, MICHELLE P. 600.00 104.00 13.00 7,800.00 7,800.00 32.50 3,046.88 - - 8.00 600.00 4.00 780.00 - - 5,586.87 - 910.00 249.99 - 13,386.87 600.00 250.00 200.00 - 1,050.00 12,336.87 650.00
Employee Name
Payout Date:
Cuttoff:
Payroll Register
06/01/2026 to 06/15/2026
6/20/2026
NABATI FOOD PHILIPPINES INC. EDD CAVITE
Salaries and Wages: 187,848.72
ACCRUALS SIL
Cutt off: 2,234.29
`;
    const metrics = parsePayrollRegisterText(text);
    expect(metrics.periodStart).toBe("2026-06-01");
    expect(metrics.periodEnd).toBe("2026-06-15");
    expect(metrics.hoursWorkedTotal).toBeCloseTo(1704, 2);
    expect(metrics.grossAmountTotal).toBeCloseTo(187848.72, 2);
    expect(metrics.netAmountTotal).toBeCloseTo(173626.9, 2);
    // Total OT column is reconciled against itemized OT + allowances
    expect(metrics.employees[0].grossAmount).toBeCloseTo(11306.39, 2);
    expect(metrics.employees[0].regOTAmount).toBeCloseTo(1640.63, 2);

    // Two employees only in fixture — skip full rollup; footer + hours still validate shape
    expect(metrics.employeeCount).toBe(2);
  });

  it("passes centavo validation on the real Cavite PDF", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pdfPath = path.join(process.cwd(), "Payrollsummary_CAVITE.pdf");
    if (!fs.existsSync(pdfPath)) return;

    const { parsePayrollRegisterPdfResult } = await import(
      "../parse-payroll-register-pdf"
    );
    const { metrics, pdfText } = await parsePayrollRegisterPdfResult(
      fs.readFileSync(pdfPath)
    );

    expect(metrics.hoursWorkedTotal).toBeCloseTo(1704, 2);
    expect(metrics.grossAmountTotal).toBeCloseTo(187848.72, 2);
    expect(metrics.employeeCount).toBe(17);
    expect(metrics.employees[0].grossAmount).toBeCloseTo(11306.39, 2);

    expect(() =>
      validateParsedRegisterMetrics(metrics, {
        requireExactCentavos: true,
        pdfText,
      })
    ).not.toThrow();
  });

  it("does not steal Taytay (gross @22) as GP-internal", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pdfPath = path.join(process.cwd(), "Payrollsummary_TAYTAY.pdf");
    if (!fs.existsSync(pdfPath)) return;

    const { parsePayrollRegisterPdfResult } = await import(
      "../parse-payroll-register-pdf"
    );
    const { metrics, pdfText } = await parsePayrollRegisterPdfResult(
      fs.readFileSync(pdfPath)
    );

    expect(metrics.hoursWorkedTotal).toBeCloseTo(734.45, 2);
    expect(metrics.grossAmountTotal).toBeCloseTo(96474.81, 2);
    expect(metrics.netAmountTotal).toBeCloseTo(88424.81, 2);
    expect(metrics.employeeCount).toBe(10);
    expect(metrics.employees[0].dailyRate).toBeCloseTo(695, 2);
    expect(metrics.employees[0].netAmount).toBeGreaterThan(0);

    expect(() =>
      validateParsedRegisterMetrics(metrics, {
        requireExactCentavos: true,
        pdfText,
      })
    ).not.toThrow();
  });

  it("parses Baesa without shifting Daily Rate into Hours", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pdfPath = path.join(process.cwd(), "Payrollsummary_BAESA.pdf");
    if (!fs.existsSync(pdfPath)) return;

    const { parsePayrollRegisterPdfResult } = await import(
      "../parse-payroll-register-pdf"
    );
    const { metrics, pdfText } = await parsePayrollRegisterPdfResult(
      fs.readFileSync(pdfPath)
    );

    expect(metrics.hoursWorkedTotal).toBeCloseTo(705.06, 2);
    expect(metrics.grossAmountTotal).toBeCloseTo(110069.54, 2);
    expect(metrics.netAmountTotal).toBeCloseTo(101369.54, 2);
    expect(metrics.employeeCount).toBe(8);
    expect(metrics.employees[0].dailyRate).toBeCloseTo(695, 2);
    expect(metrics.employees[0].hoursWorked).toBeCloseTo(16, 2);
    expect(metrics.employees[0].netAmount).toBeCloseTo(1536.94, 2);

    expect(() =>
      validateParsedRegisterMetrics(metrics, {
        requireExactCentavos: true,
        pdfText,
      })
    ).not.toThrow();
  });
});
