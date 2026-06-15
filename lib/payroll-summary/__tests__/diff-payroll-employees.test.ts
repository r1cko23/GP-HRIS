import { diffPayrollEmployees } from "../diff-payroll-employees";
import { employeeNameSimilarity } from "../employee-name-match";
import type { PayrollSummaryMetrics } from "../types";

function employee(
  name: string,
  overrides: Partial<PayrollSummaryMetrics["employees"][number]> = {}
) {
  return {
    name,
    dailyRate: 500,
    hoursWorked: 96,
    daysWorked: 12,
    basicSalary: 6000,
    totalSalary: 6000,
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
    grossAmount: 6000,
    sss: 0,
    sssPRO: 0,
    philhealth: 0,
    pagibig: 0,
    withholdingTax: 0,
    sssLoan: 0,
    otherDeduction: 0,
    totalDeduction: 0,
    netAmount: 6000,
    thirteenthMonthCutoff: 0,
    silCutoff: 0,
    thirteenthMonthYTD: 0,
    ...overrides,
  };
}

function metrics(
  employees: PayrollSummaryMetrics["employees"],
  overrides: Partial<PayrollSummaryMetrics> = {}
): PayrollSummaryMetrics {
  return {
    periodStart: "2025-05-01",
    periodEnd: "2025-05-15",
    employeeCount: employees.length,
    hoursWorkedTotal: employees.reduce((s, e) => s + e.hoursWorked, 0),
    regOTHoursTotal: 0,
    silTotal: 0,
    silCutoffTotal: 0,
    grossAmountTotal: employees.reduce((s, e) => s + e.grossAmount, 0),
    netAmountTotal: employees.reduce((s, e) => s + e.netAmount, 0),
    totalOTAmount: 0,
    companyName: "Test Co",
    payoutDate: null,
    sourceFormat: "external_register",
    employees,
    ...overrides,
  };
}

describe("employeeNameSimilarity", () => {
  test("matches reordered Filipino names", () => {
    const score = employeeNameSimilarity(
      "ALBERTO, JONATHAN C.",
      "JONATHAN C. ALBERTO"
    );
    expect(score).toBeGreaterThanOrEqual(0.72);
  });
});

describe("diffPayrollEmployees", () => {
  test("flags added employee with hours as potential ghost", () => {
    const previous = metrics([employee("JON DOE")]);
    const current = metrics([
      employee("JON DOE"),
      employee("GHOST PERSON", { hoursWorked: 48, grossAmount: 3000, netAmount: 3000 }),
    ]);

    const result = diffPayrollEmployees(current, previous);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].riskFlags).toContain("potential_ghost");
    expect(result.added[0].manpowerCostDelta).toBeGreaterThan(0);
  });

  test("detects illegal regular hours increase", () => {
    const previous = metrics([employee("JANE DOE", { hoursWorked: 96, grossAmount: 6000 })]);
    const current = metrics([
      employee("JANE DOE", { hoursWorked: 120, grossAmount: 7500, netAmount: 7500 }),
    ]);

    const result = diffPayrollEmployees(current, previous);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].riskFlags).toContain("hours_increase");
    expect(result.changed[0].riskFlags).toContain("gross_increase");
    expect(result.changed[0].fieldChanges.some((c) => c.key === "regOTHours")).toBe(
      false
    );
    expect(result.changed[0].hoursDelta).toBe(24);
  });

  test("pairs likely renames instead of add+remove", () => {
    const previous = metrics([employee("DELA CRUZ, MARIA A.")]);
    const current = metrics([employee("MARIA A. DELA CRUZ")]);

    const result = diffPayrollEmployees(current, previous);
    expect(result.renamed).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.renamed[0].previousName).toBe("DELA CRUZ, MARIA A.");
  });

  test("diffs OT, holiday pay, and loan fields", () => {
    const previous = metrics([employee("PEDRO SAN")]);
    const current = metrics([
      employee("PEDRO SAN", {
        regOTHours: 8,
        regOTAmount: 500,
        specialHolidayAmount: 800,
        sssLoan: 200,
        grossAmount: 7300,
        netAmount: 7100,
      }),
    ]);

    const result = diffPayrollEmployees(current, previous);
    expect(result.changed[0].fieldChanges.map((c) => c.key)).toEqual(
      expect.arrayContaining([
        "regOTHours",
        "regOTAmount",
        "specialHolidayAmount",
        "sssLoan",
        "grossAmount",
      ])
    );
    expect(result.changed[0].riskFlags).toEqual(
      expect.arrayContaining(["ot_increase", "holiday_pay_increase"])
    );
  });
});
