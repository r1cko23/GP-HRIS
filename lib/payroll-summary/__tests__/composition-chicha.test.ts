import { describe, expect, it } from "vitest";
import { buildPeriodComposition } from "../composition-chart";
import { parseRegisterRow, EXTERNAL_CHICHA_24_LAYOUT } from "../register-columns";
import type { PayrollSummaryMetrics } from "../types";

describe("composition — Chicha 24-col OT columns", () => {
  it("maps Reg Nightdiff OT Amt and avoids Other / unmapped crumbs", () => {
    const nums = [
      500, 104, 13, 6500, 6500,
      0, 0, // reg OT
      0, 0, // night diff
      0, 0, // legal holiday
      0, 10.86, // reg nightdiff OT hrs / amt
      10.86, // total OT subtotal
      6510.86, // gross
      300, 100, 50, 0, 450, 6060.86, 0, 0, 0,
    ];

    const row = parseRegisterRow("SAMPLE, EMPLOYEE", nums, EXTERNAL_CHICHA_24_LAYOUT);
    expect(row).not.toBeNull();
    expect(row!.regNightdiffOTAmount).toBe(10.86);
    expect(row!.totalOTAmount).toBe(0);

    const metrics: PayrollSummaryMetrics = {
      periodStart: "2026-05-01",
      periodEnd: "2026-05-15",
      employeeCount: 1,
      hoursWorkedTotal: 104,
      regOTHoursTotal: 0,
      silTotal: 0,
      silCutoffTotal: 0,
      grossAmountTotal: row!.grossAmount,
      netAmountTotal: row!.netAmount,
      totalOTAmount: 0,
      companyName: null,
      payoutDate: null,
      sourceFormat: "external_register",
      employees: [row!],
    };

    const comp = buildPeriodComposition(metrics, "gross");
    const other = comp.slices.find((s) => s.key === "other");
    const regNd = comp.slices.find((s) => s.key === "regNightdiffOTAmount");

    expect(regNd?.value).toBe(10.86);
    expect(other?.value ?? 0).toBeLessThanOrEqual(0.01);
  });
});
