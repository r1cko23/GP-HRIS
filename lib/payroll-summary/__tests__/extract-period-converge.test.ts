import { describe, expect, it } from "vitest";
import {
  extractPeriod,
  inferBiMonthlyPeriodEnd,
  parsePayrollRegisterText,
} from "../parse-payroll-register-pdf";

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
});
