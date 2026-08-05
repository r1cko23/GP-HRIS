import { describe, expect, it } from "vitest";
import {
  isLevelwearRegister,
  resolveLevelwear28Layout,
  resolveExternalRegisterLayout,
} from "../register-columns";
import { extractPeriod, parsePayrollRegisterText } from "../parse-payroll-register-pdf";

const LEVELWEAR_DEC_HEADERS = `
Daily Rate Hours Days Basic Total Salary
Reg OT Hours Reg OT Amt NightDiff Hours NightDiff Amt
Legal Holiday Hours Legal Holiday Amt Legal Holiday ND Hours Legal Holiday ND Amt
Special Holiday Hours Special Holiday Amt Special Holiday ND Hours Special Holiday ND Amt
Total OT Service Incentive Leave Allowance Gross Amt
SSS SSS Pro PHILHEALT H Withholding Tax SSS Loan Pag-Ibig Loan Total Deduction
`;

describe("isLevelwearRegister", () => {
  it("matches space-separated Special Holiday headers (not only newline form)", () => {
    expect(isLevelwearRegister(LEVELWEAR_DEC_HEADERS)).toBe(true);
    expect(
      isLevelwearRegister(
        "Legal\nHoliday\nSpecial\nHoliday\nService Incentive Leave"
      )
    ).toBe(true);
    // Bare Legal+Special without SIL/LEVELWEAR must not claim Levelwear
    // (Nabati EDD also splits "Legal\\nHoliday" across lines).
    expect(
      isLevelwearRegister("Legal\nHoliday\nSpecial\nHoliday")
    ).toBe(false);
  });
});

describe("resolveLevelwear28Layout", () => {
  it("anchors gross to Salaries and Wages when ND columns shift the block", () => {
    const nums = [
      14350, 544, 68, 96300, 96300, 1, 273.44, 512, 9130, 32, 5000, 32, 1000, 48,
      2805, 48, 1215.5, 31823.94, 6400, 6000, 128123.94, 2300, 3425, 2407.5,
      649.11, 830.61, 650.81, 10263.03,
    ];
    const text = `${LEVELWEAR_DEC_HEADERS}\nSalaries and Wages: 128,123.94\nSSS Pro`;
    const layout = resolveLevelwear28Layout(text, nums, true);
    expect(layout.grossAmount).toBe(20);
    expect(layout.totalOTAmount).toBe(17);
    expect(layout.sss).toBe(21);
    expect(layout.sssPRO).toBe(22);
  });

  it("keeps gross @18 for the older Levelwear column pack", () => {
    const nums = Array.from({ length: 28 }, (_, i) =>
      i === 18 ? 121607.26 : i + 1
    );
    const text = `Legal Holiday Special Holiday\nSalaries and Wages: 121,607.26`;
    const layout = resolveLevelwear28Layout(text, nums, true);
    expect(layout.grossAmount).toBe(18);
    expect(layout.totalOTAmount).toBe(15);
  });
});

describe("Levelwear Dec cutoff parse", () => {
  it("does not treat Levelwear as Converge (gross at last column)", () => {
    const nums = [
      14350, 544, 68, 96300, 96300, 1, 273.44, 512, 9130, 32, 5000, 32, 1000, 48,
      2805, 48, 1215.5, 31823.94, 6400, 6000, 128123.94, 2300, 3425, 2407.5,
      649.11, 830.61, 650.81, 10263.03,
    ];
    const layout = resolveExternalRegisterLayout(
      28,
      `${LEVELWEAR_DEC_HEADERS}\nSalaries and Wages: 128,123.94`,
      nums,
      { isTotalRow: true }
    );
    expect(layout?.grossAmount).toBe(20);
    expect(nums[layout!.grossAmount!]).toBeCloseTo(128123.94, 2);
    // Converge would have picked index 27 (10,263.03)
    expect(layout?.grossAmount).not.toBe(27);
  });

  it("parses Cuttoff start+payout and footer gross", () => {
    const nums = [
      14350, 544, 68, 96300, 96300, 1, 273.44, 512, 9130, 32, 5000, 32, 1000, 48,
      2805, 48, 1215.5, 31823.94, 6400, 6000, 128123.94, 2300, 3425, 2407.5,
      649.11, 830.61, 650.81, 10263.03,
    ].join(" ");
    const emp = [
      1500, 56, 7, 10500, 10500, 0, 0, 56, 1050, 0, 0, 0, 0, 8, 450, 8, 195,
      2695, 0, 1000, 13195, 225, 375, 262.5, 137.47, 0, 0, 999.97,
    ].join(" ");
    const text = `
${LEVELWEAR_DEC_HEADERS}
Empl : Cuttoff: 12/16/2025  1/5/2026
Total Deduction Total ${nums}
1. AQUE, JOANNI MARI T. ${emp}
Salaries and Wages: 128,123.94
ACCRUALS SIL
Cutt off: 1,538.33
`;
    expect(extractPeriod(text)).toEqual({
      periodStart: "2025-12-16",
      periodEnd: "2025-12-31",
    });
    const metrics = parsePayrollRegisterText(text);
    expect(metrics.periodStart).toBe("2025-12-16");
    expect(metrics.periodEnd).toBe("2025-12-31");
    expect(metrics.payoutDate).toBe("2026-01-05");
    expect(metrics.grossAmountTotal).toBeCloseTo(128123.94, 2);
    expect(metrics.employeeCount).toBeGreaterThanOrEqual(1);
  });
});
