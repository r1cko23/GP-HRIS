import { describe, expect, it } from "vitest";
import {
  buildLayoutFromHeaderLabels,
  detectExternalRegisterLayout,
  extractRegisterHeaderBlock,
  refineLabelsToColumnCount,
  tokenizeRegisterHeaderLabels,
} from "../detect-register-layout";

const NABATI_HEADER = `Daily Rate Hours Days Basic Total Salary Reg OT
Hours
Reg OT Amt Reg Nightdiff
OT Hours
Reg Nightdiff
OT Amt
Total OT Service
Incentive
Leave
Meal
Allowance
COMM
Allowance
Gas & Motor Gross Amt SSS SSS Pro PHILHEALT
H
PagIbig Total
Deduction
Net Amount 13th Month
Cuttoff
SIL Cuttoff 13th Month
YTD`;

describe("detect-register-layout", () => {
  it("tokenizes Nabati 24-column header", () => {
    const joined = NABATI_HEADER.split(/\r?\n/).join(" ").replace(/\s+/g, " ");
    const labels = tokenizeRegisterHeaderLabels(joined);
    expect(labels.length).toBe(24);
    expect(labels[0]).toBe("Daily Rate");
    expect(labels.at(-1)).toBe("13th Month YTD");
  });

  it("builds layout with gross and net indices", () => {
    const joined = NABATI_HEADER.split(/\r?\n/).join(" ").replace(/\s+/g, " ");
    const labels = tokenizeRegisterHeaderLabels(joined);
    const layout = buildLayoutFromHeaderLabels(labels, 24);
    expect(layout).not.toBeNull();
    expect(layout!.grossAmount).toBe(14);
    expect(layout!.netAmount).toBe(20);
    expect(layout!.minColumns).toBe(24);
  });

  it("refines over-long label lists to match column count", () => {
    const labels = tokenizeRegisterHeaderLabels(
      "Daily Rate Hours Days Basic Total Salary Reg OT Hours Reg OT Amt Gross Amt SSS Net Amount"
    );
    const refined = refineLabelsToColumnCount(labels, 8);
    expect(refined.length).toBeLessThanOrEqual(8);
  });

  it("remaps compact registers without Reg OT header to reg OT columns", () => {
    const chichaHeader = `Daily Rate Hours Days Basic Total Salary NightDiff
Hours
NightDiff Amt Legal
Holiday
Hours
Legal
Holiday Amt
Total OT Gross Amt SSS PHILHEALT
H
SSS Loan Pag-Ibig
Loan
Other
Deduction
Total
Deduction
Net Amount 13th Month
Cuttoff
SIL Cuttoff 13th Month
YTD`
      .split(/\r?\n/)
      .join(" ")
      .replace(/\s+/g, " ");
    const labels = tokenizeRegisterHeaderLabels(chichaHeader);
    const layout = buildLayoutFromHeaderLabels(labels, 21);
    expect(layout!.regOTHours).toBe(5);
    expect(layout!.regOTAmount).toBe(6);
    expect(layout!.nightDiffAmount).toBeUndefined();
    expect(layout!.specialHolidayAmount).toBe(8);
  });

  it("maps Chicha 24-col Reg Nightdiff OT after Legal Holiday", () => {
    const chicha24Header = `Daily Rate Hours Days Basic Total Salary Reg OT Hours Reg OT Amt NightDiff Hours NightDiff Amt Legal Holiday Hours Legal Holiday Amt Reg Nightdiff OT Hours Reg Nightdiff OT Amt Total OT Gross Amt SSS PHILHEALT H PagIbig Other Deduction Total Deduction Net Amount 13th Month Cuttoff SIL Cuttoff 13th Month YTD`;
    const layout = buildLayoutFromHeaderLabels(
      tokenizeRegisterHeaderLabels(chicha24Header),
      24
    );
    expect(layout!.regNightdiffOTAmount).toBe(12);
    expect(layout!.nightDiffAmount).toBe(8);
    expect(layout!.specialHolidayAmount).toBe(10);
    expect(layout!.totalOTAmount).toBe(13);
  });

  it("detects layout from full register text", () => {
    const text = `${NABATI_HEADER}
Total 8,340.00 1,162.03 145.25 100,951.36 100,951.36 491.00 53,319.53 182.00 1,976.41 69,038.74 3,475.00 5,758.59 1,278.58 3,230.63 169,990.10 7,375.00 475.00 3,000.00 2,400.00 13,250.00 156,740.10 8,412.62 1,612.60 34,157.60
1. SAMPLE, EMPLOYEE A. 695.00 104.00 13.00 9,035.00 9,035.00 133.00 14,442.97 86.00 933.91 15,376.88 0 0 0 0 24,411.88 1,000.00 225.00 250.00 200.00 1,675.00 22,736.88 752.92 144.33 3,011.67`;

    const block = extractRegisterHeaderBlock(text);
    expect(block).toBeTruthy();

    const detected = detectExternalRegisterLayout(text, 24);
    expect(detected).not.toBeNull();
    expect(detected!.layout.grossAmount).toBe(14);
  });
});
