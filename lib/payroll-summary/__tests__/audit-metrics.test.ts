import { describe, expect, it } from "vitest";
import { buildAuditMetricsSummary, sumAuditMetricTotals } from "../audit-metrics";
import { diffPayrollEmployees } from "../diff-payroll-employees";
import type { PayrollSummaryMetrics } from "../types";

function emp(
  name: string,
  overrides: Partial<PayrollSummaryMetrics["employees"][0]> = {}
) {
  return {
    name,
    dailyRate: 500,
    hoursWorked: 104,
    daysWorked: 13,
    basicSalary: 6500,
    totalSalary: 6500,
    regOTHours: 8,
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
    totalOTAmount: 500,
    serviceIncentiveLeaveAmount: 200,
    refund: 0,
    transpoAllowance: 0,
    loadAllowance: 0,
    allowance: 0,
    grossAmount: 7200,
    sss: 300,
    sssPRO: 0,
    philhealth: 100,
    pagibig: 50,
    withholdingTax: 0,
    sssLoan: 0,
    otherDeduction: 0,
    totalDeduction: 450,
    netAmount: 6750,
    thirteenthMonthCutoff: 0,
    silCutoff: 50,
    thirteenthMonthYTD: 0,
    ...overrides,
  };
}

function metrics(
  employees: PayrollSummaryMetrics["employees"],
  periodStart = "2026-05-01",
  periodEnd = "2026-05-15"
): PayrollSummaryMetrics {
  const totals = sumAuditMetricTotals({
    periodStart,
    periodEnd,
    employeeCount: employees.length,
    hoursWorkedTotal: employees.reduce((s, e) => s + e.hoursWorked, 0),
    regOTHoursTotal: employees.reduce((s, e) => s + e.regOTHours, 0),
    silTotal: employees.reduce((s, e) => s + e.serviceIncentiveLeaveAmount, 0),
    silCutoffTotal: employees.reduce((s, e) => s + e.silCutoff, 0),
    grossAmountTotal: employees.reduce((s, e) => s + e.grossAmount, 0),
    netAmountTotal: employees.reduce((s, e) => s + e.netAmount, 0),
    totalOTAmount: employees.reduce((s, e) => s + e.totalOTAmount, 0),
    companyName: null,
    payoutDate: null,
    sourceFormat: "external_register",
    employees,
  });

  return {
    periodStart,
    periodEnd,
    employeeCount: employees.length,
    hoursWorkedTotal: totals.hoursWorked,
    regOTHoursTotal: totals.totalOTHours,
    silTotal: totals.silAmount,
    silCutoffTotal: employees.reduce((s, e) => s + e.silCutoff, 0),
    grossAmountTotal: employees.reduce((s, e) => s + e.grossAmount, 0),
    netAmountTotal: employees.reduce((s, e) => s + e.netAmount, 0),
    totalOTAmount: totals.totalOTAmount,
    companyName: null,
    payoutDate: null,
    sourceFormat: "external_register",
    employees,
  };
}

describe("audit-metrics", () => {
  it("sums manning, hours, OT, SIL, and holiday totals from employees", () => {
    const totals = sumAuditMetricTotals(
      metrics([
        emp("A", { hoursWorked: 100, totalSalary: 5000, totalOTAmount: 300 }),
        emp("B", {
          hoursWorked: 80,
          totalSalary: 4000,
          specialHolidayHours: 8,
          specialHolidayAmount: 400,
          sssLoan: 150,
        }),
      ])
    );

    expect(totals.employeeCount).toBe(2);
    expect(totals.hoursWorked).toBe(180);
    expect(totals.totalSalary).toBeGreaterThan(0);
    expect(totals.holidayHours).toBe(8);
    expect(totals.holidayPay).toBe(400);
    expect(totals.salaryLoan).toBe(150);
    expect(totals.silHours).toBeNull();
  });

  it("builds period change and anomaly counts per metric", () => {
    const previous = metrics([emp("ALPHA, JUAN")]);
    const current = metrics([
      emp("ALPHA, JUAN", { hoursWorked: 120, totalSalary: 7000 }),
      emp("BRAVO, MARIA", { hoursWorked: 104, grossAmount: 8000 }),
    ]);

    const anomalies = diffPayrollEmployees(current, previous);
    const summary = buildAuditMetricsSummary(current, previous, anomalies);

    const manning = summary.rows.find((r) => r.key === "employeeCount");
    const hours = summary.rows.find((r) => r.key === "hoursWorked");
    const regularPay = summary.rows.find((r) => r.key === "totalSalary");

    expect(manning?.delta).toBe(1);
    expect(manning?.anomalies.added).toBe(1);
    expect(hours?.delta).toBe(120);
    expect(hours?.anomalies.changed).toBe(1);
    expect(regularPay?.anomalies.changed).toBe(1);
  });
});
