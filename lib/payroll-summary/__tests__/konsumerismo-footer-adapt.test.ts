import { describe, expect, it } from "vitest";
import {
  resolveFooterAnchored28Layout,
  resolveExternalRegisterLayout,
} from "../register-columns";
import { extractPeriod, parsePayrollRegisterText } from "../parse-payroll-register-pdf";

const KONSUMERISMO_HEADERS = `
Daily Rate Hours Days Basic Total Salary
Reg OT Hours Reg OT Amt
Legal Holiday Hours Legal Holiday Amt Legal Holiday OT Hours Legal Holiday OT Amt
Special Holiday Hours Special Holiday Amt Special Holiday OT Hours Special Holiday OT Amt
Restday Hours Restday Amt Restday OT Hours Restday OT Amt
Total OT Gross Amt SSS SSS Pro PHILHEALT H Total Deduction Net Amount
13th Month Cuttoff SIL Cuttoff
`;

/** Dec 16–31 Konsumerismo totals (Salaries and Wages 29,631.33). */
const KONSUM_TOTALS = [
  1390, 231.93, 28.99, 20148.92, 20148.92, 41, 4452.34, 16, 1390, 5, 1129.38, 16,
  417, 1, 146.82, 24, 625.5, 9, 1321.37, 9482.41, 29631.33, 725, 775, 455.24,
  1955.24, 27676.09, 1679.07, 321.85,
];

describe("resolveFooterAnchored28Layout — adapt without a client name", () => {
  it("anchors Konsumerismo gross at index 20 from Salaries and Wages", () => {
    const text = `${KONSUMERISMO_HEADERS}\nSalaries and Wages: 29,631.33\nSSS Pro`;
    const layout = resolveFooterAnchored28Layout(text, KONSUM_TOTALS);
    expect(layout?.grossAmount).toBe(20);
    expect(layout?.totalOTAmount).toBe(19);
    expect(layout?.netAmount).toBe(25);
    expect(layout?.silCutoff).toBe(27);
    expect(KONSUM_TOTALS[layout!.grossAmount!]).toBeCloseTo(29631.33, 2);
  });

  it("does not steal Converge when footer gross is in the tail (26/27)", () => {
    const nums = Array.from({ length: 28 }, (_, i) => (i === 27 ? 2486064.9 : i));
    const text = `Income Adjustment Allowance Gross Amt\nSalaries and Wages: 2,486,064.90`;
    expect(resolveFooterAnchored28Layout(text, nums)).toBeNull();
  });
});

describe("Konsumerismo parse adaptation", () => {
  it("uses footer-anchored layout instead of Converge col 27", () => {
    const layout = resolveExternalRegisterLayout(
      28,
      `${KONSUMERISMO_HEADERS}\nSalaries and Wages: 29,631.33`,
      KONSUM_TOTALS,
      { isTotalRow: true }
    );
    expect(layout?.grossAmount).toBe(20);
    expect(layout?.grossAmount).not.toBe(27);
  });

  it("parses Cuttoff + totals with correct gross/net/SIL", () => {
    const emp = [
      695, 119.93, 14.99, 10418.92, 10418.92, 17, 1846.09, 8, 695, 3, 677.63, 8,
      208.5, 0, 0, 16, 400, 4, 500, 4000, 15000, 300, 350, 200, 850, 14150, 800,
      150,
    ].join(" ");
    const text = `
${KONSUMERISMO_HEADERS}
Empl : Cuttoff: 12/16/2025  1/5/2026
SIL Cuttoff Total ${KONSUM_TOTALS.join(" ")}
1. CASAUL, JULIA A. ${emp}
Salaries and Wages: 29,631.33
ACCRUALS SIL
Cutt off: 321.85
`;
    expect(extractPeriod(text)).toEqual({
      periodStart: "2025-12-16",
      periodEnd: "2025-12-31",
    });
    const metrics = parsePayrollRegisterText(text);
    expect(metrics.grossAmountTotal).toBeCloseTo(29631.33, 2);
    expect(metrics.netAmountTotal).toBeCloseTo(27676.09, 2);
    expect(metrics.silCutoffTotal).toBeCloseTo(321.85, 2);
    expect(metrics.payoutDate).toBe("2026-01-05");
  });
});
