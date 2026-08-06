import { describe, expect, it } from "vitest";
import {
  extractPeriod,
  inferBiMonthlyPeriodEnd,
  parsePayrollRegisterText,
} from "../parse-payroll-register-pdf";
import { resolveExternalRegisterLayout } from "../register-columns";

describe("inferBiMonthlyPeriodEnd", () => {
  it("maps 1–15 starts to the 15th", () => {
    expect(inferBiMonthlyPeriodEnd("2026-05-01")).toBe("2026-05-15");
  });

  it("maps 16–EOM starts to the last day of the month", () => {
    expect(inferBiMonthlyPeriodEnd("2026-05-16")).toBe("2026-05-31");
    expect(inferBiMonthlyPeriodEnd("2025-12-16")).toBe("2025-12-31");
  });
});

describe("extractPeriod — Converge Cuttoff start+payout", () => {
  it("parses Cuttoff without 'to' and infers period end", () => {
    const text = "Empl : Cuttoff: 12/16/2025  1/5/2026\nTotal 1 2 3";
    expect(extractPeriod(text)).toEqual({
      periodStart: "2025-12-16",
      periodEnd: "2025-12-31",
    });
  });

  it("parses May Converge Cuttoff the same way", () => {
    expect(
      extractPeriod("Empl : Cuttoff: 05/01/2026  5/20/2026")
    ).toEqual({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-15",
    });
    expect(
      extractPeriod("Empl : Cuttoff: 05/16/2026  6/5/2026")
    ).toEqual({
      periodStart: "2026-05-16",
      periodEnd: "2026-05-31",
    });
  });

  it("still prefers an explicit 'to' range when present", () => {
    const text = "Cutoff: 05/01/2026 to 05/15/2026\nPayout Date: 05/20/2026";
    expect(extractPeriod(text)).toEqual({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-15",
    });
  });
});

describe("parsePayrollRegisterText — Converge Cuttoff + mid-line Total", () => {
  it("keeps a footer-anchored mid-row gross instead of forcing Converge tail", () => {
    const totals = [
      121224.33, 16365.63, 2045.71, 1455009.73, 1455009.73, 5577.5,
      613213.27, 1468, 12834.5, 1091, 165134.32, 1866, 20401.61,
      877143.62, 6475, 59084.92, 2332153.35, 46050, 53600, 30063.83, 600,
      30273.1, 31652.76, 4603, 3264.71, 19630.4, 219737.8, 2112415.55,
    ];
    const text = `
Daily Rate Hours Days Basic Total Salary Reg OT Hours Reg OT Amt
NightDiff Hours NightDiff Amt Restday OT Hours Restday OT Amt
Reg Nightdiff OT Hours Reg Nightdiff OT Amt Total OT Service Incentive Leave
Allowance Gross Amt SSS SSS Pro PHILHEALTH PagIbig SSS Loan
Other Deduction Total Deduction Net Amount
CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC
Salaries and Wages: 2,332,153.35
`;
    const layout = resolveExternalRegisterLayout(28, text, totals, {
      isTotalRow: true,
    });
    expect(layout?.grossAmount).toBe(16);
    expect(layout?.totalDeduction).toBe(26);
    expect(layout?.netAmount).toBe(27);
  });

  it("detects period/payout when Cuttoff has start+payout only", () => {
    const nums = Array.from({ length: 28 }, (_, i) => (i === 27 ? 1945409.21 : i + 1)).join(
      " "
    );
    const text = `
Daily Rate Hours Days Basic Total Salary Reg OT Hours
Empl : Cuttoff: 12/16/2025  1/5/2026
Gross Amt Total ${nums}
1. ABELLON JR, JEFFY M. ${nums}
Salaries and Wages: 1,945,409.21
`;
    const metrics = parsePayrollRegisterText(text);
    expect(metrics.periodStart).toBe("2025-12-16");
    expect(metrics.periodEnd).toBe("2025-12-31");
    expect(metrics.payoutDate).toBe("2026-01-05");
    expect(metrics.grossAmountTotal).toBeCloseTo(1945409.21, 2);
  });

  it("merges deduction/net columns from every horizontal continuation page", () => {
    const total = [
      1390, 160, 20, 8000, 8000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      2000, 10000, 500, 0, 200, 100, 0, 0, 100, 100,
    ].join(" ");
    const employee1 = [
      695, 96, 12, 4800, 4800, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      1200, 6000, 300, 0, 100, 50, 0, 0, 0, 0,
    ].join(" ");
    const employee2 = [
      695, 64, 8, 3200, 3200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      800, 4000, 200, 0, 100, 50, 0, 0, 0, 0,
    ].join(" ");

    const text = `
Daily Rate Hours Days Basic Total Salary Reg OT Hours Reg OT Amt
Total OT Allowance Gross Amt SSS SSS Pro PHILHEALTH PagIbig SSS Loan
Cuttoff: 07/16/2026 to 07/31/2026
Total ${total}
1. ALPHA, EMPLOYEE A. ${employee1}
-- 1 of 4 --
Other Deduction Total Deduction Net Amount 13th Month Cuttoff SIL Cuttoff YTD
100 1000 9000 800 150 10000
0 600 5400 500 100 6000
-- 2 of 4 --
Daily Rate Hours Days Basic Total Salary
2. BETA, EMPLOYEE B. ${employee2}
-- 3 of 4 --
Other Deduction Total Deduction Net Amount 13th Month Cuttoff SIL Cuttoff YTD
0 400 3600 300 50 4000
-- 4 of 4 --
Salaries and Wages: 10,000.00
CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC
`;
    const metrics = parsePayrollRegisterText(text);
    expect(metrics.employeeCount).toBe(2);
    expect(metrics.grossAmountTotal).toBeCloseTo(10000, 2);
    expect(metrics.netAmountTotal).toBeCloseTo(9000, 2);
    expect(metrics.employees.map((employee) => employee.netAmount)).toEqual([
      5400, 3600,
    ]);
  });
});
