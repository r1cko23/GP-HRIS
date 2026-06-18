import { describe, expect, it } from "vitest";
import { buildCategoryChangeDrilldown } from "../category-change-drilldown";
import { buildPeriodChanges } from "../category-breakdown";
import type { PayrollSummaryMetrics } from "../types";

function emp(name: string, overrides: Record<string, number> = {}) {
  return {
    name,
    dailyRate: 500,
    hoursWorked: 104,
    daysWorked: 13,
    basicSalary: 6500,
    totalSalary: 6500,
    regOTHours: 0,
    regOTAmount: 0,
    nightDiffHours: 0,
    nightDiffAmount: 0,
    regNightdiffOTHours: 0,
    regNightdiffOTAmount: 0,
    specialHolidayHours: 0,
    specialHolidayAmount: 0,
    specialHolidayOTHours: 0,
    specialHolidayOTAmount: 0,
    restdayHours: 0,
    restdayAmount: 0,
    totalOTAmount: 0,
    serviceIncentiveLeaveAmount: 0,
    refund: 0,
    transpoAllowance: 0,
    loadAllowance: 0,
    allowance: 0,
    grossAmount: 6500,
    sss: 300,
    sssPRO: 0,
    philhealth: 100,
    pagibig: 50,
    withholdingTax: 0,
    sssLoan: 0,
    otherDeduction: 0,
    totalDeduction: 450,
    netAmount: 6050,
    thirteenthMonthCutoff: 0,
    silCutoff: 0,
    thirteenthMonthYTD: 0,
    ...overrides,
  };
}

function metrics(
  employees: PayrollSummaryMetrics["employees"],
  periodStart = "2026-05-01",
  periodEnd = "2026-05-15"
): PayrollSummaryMetrics {
  return {
    periodStart,
    periodEnd,
    employeeCount: employees.length,
    hoursWorkedTotal: employees.reduce((s, e) => s + e.hoursWorked, 0),
    regOTHoursTotal: employees.reduce((s, e) => s + e.regOTHours, 0),
    silTotal: 0,
    silCutoffTotal: 0,
    grossAmountTotal: employees.reduce((s, e) => s + e.grossAmount, 0),
    netAmountTotal: employees.reduce((s, e) => s + e.netAmount, 0),
    totalOTAmount: 0,
    companyName: null,
    payoutDate: null,
    sourceFormat: "external_register",
    employees,
  };
}

describe("category-change-drilldown", () => {
  it("attributes regular pay change to employees with hours reason", () => {
    const previous = metrics([emp("ALPHA, JUAN", { totalSalary: 6500, hoursWorked: 104 })]);
    const current = metrics([
      emp("ALPHA, JUAN", { totalSalary: 7800, hoursWorked: 120 }),
    ]);

    const changes = buildPeriodChanges(previous, current);
    const regularPay = changes.find((c) => c.key === "totalSalary");
    expect(regularPay).toBeTruthy();

    const drill = buildCategoryChangeDrilldown(previous, current, regularPay!);
    expect(drill.contributors).toHaveLength(1);
    expect(drill.contributors[0].name).toBe("ALPHA, JUAN");
    expect(drill.contributors[0].delta).toBe(1300);
    expect(drill.contributors[0].reason).toContain("Regular hours");
    expect(drill.contributors[0].drivers.some((d) => d.key === "hoursWorked")).toBe(
      true
    );
  });

  it("shows OT and SIL drivers on gross pay contributors", () => {
    const previous = metrics([
      emp("BETA, MARIA", { grossAmount: 7000, totalSalary: 6500, regOTAmount: 500 }),
    ]);
    const current = metrics([
      emp("BETA, MARIA", {
        grossAmount: 8200,
        totalSalary: 6500,
        regOTAmount: 1200,
        serviceIncentiveLeaveAmount: 500,
      }),
    ]);

    const changes = buildPeriodChanges(previous, current);
    const gross = changes.find((c) => c.key === "grossAmount");
    expect(gross).toBeTruthy();

    const drill = buildCategoryChangeDrilldown(previous, current, gross!);
    expect(drill.contributors[0].drivers.some((d) => d.key === "regOTAmount")).toBe(
      true
    );
    expect(
      drill.contributors[0].drivers.some(
        (d) => d.key === "serviceIncentiveLeaveAmount"
      )
    ).toBe(true);
  });
});
