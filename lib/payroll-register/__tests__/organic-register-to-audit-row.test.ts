import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYROLL_REGISTER_HEADERS } from "@/lib/payroll-summary/register-columns";
import { sumAuditMetricTotals } from "@/lib/payroll-summary/audit-metrics";
import { buildOrganicRegisterSummaryTable } from "../build-register-summary-table";
import { organicRegisterLineToAuditRow } from "../organic-register-to-audit-row";

function claireLine() {
  return {
    employee_code: "202309-00023",
    last_name: "Aban",
    first_name: "Claire",
    daily_rate: 800,
    gross_pay: 11600,
    total_deductions: 1578.42,
    net_pay: 10021.58,
    hours: {
      actual_regular_hours: 80,
      overtime_hours: 8,
      night_diff_hours: 4,
      regular_night_ot_hours: 2,
      legal_holiday_hours: 8,
      legal_holiday_ot_hours: 2,
      special_holiday_hours: 8,
      special_holiday_ot_hours: 0,
      rest_day_hours: 8,
      rest_day_ot_hours: 0,
      wdo_hours: 0,
      pto_hours: 8,
    },
    earnings: {
      basic: 8000,
      overtime: 1000,
      night_diff: 500,
      regular_night_ot: 312.5,
      legal_holiday: 1600,
      legal_holiday_ot: 500,
      special_holiday: 1000,
      rest_day: 1040,
      pto: 800,
      allowance: 200,
      cola_payroll: 100,
      adjustment: 0,
    },
    deductions: {
      sss: 387.5,
      sss_wisp: 50,
      philhealth: 195,
      pagibig: 100,
      withholding_tax: 0,
      loans: 895.92,
      other: 0,
    },
  };
}

describe("organicRegisterLineToAuditRow", () => {
  it("projects hours, regular pay, OT, holiday, SIL, and loans onto payroll-audit fields", () => {
    const row = organicRegisterLineToAuditRow(claireLine());

    assert.equal(row.name, "Aban, Claire");
    assert.equal(row.dailyRate, 800);
    assert.equal(row.hoursWorked, 80);
    assert.equal(row.daysWorked, 11);
    assert.equal(row.basicSalary, 8000);
    assert.equal(row.totalSalary, 8000);
    assert.equal(row.regOTHours, 8);
    assert.equal(row.regOTAmount, 1000);
    assert.equal(row.nightDiffHours, 4);
    assert.equal(row.nightDiffAmount, 500);
    assert.equal(row.regNightdiffOTHours, 2);
    assert.equal(row.regNightdiffOTAmount, 312.5);
    assert.equal(row.specialHolidayHours, 16);
    assert.equal(row.specialHolidayAmount, 2600);
    assert.equal(row.specialHolidayOTHours, 2);
    assert.equal(row.specialHolidayOTAmount, 500);
    assert.equal(row.restdayHours, 8);
    assert.equal(row.restdayAmount, 1040);
    assert.equal(row.serviceIncentiveLeaveAmount, 800);
    assert.equal(row.allowance, 300);
    assert.equal(row.sss, 387.5);
    assert.equal(row.sssPRO, 50);
    assert.equal(row.sssLoan, 895.92);
    assert.equal(row.grossAmount, 11600);
    assert.equal(row.netAmount, 10021.58);
    assert.equal(row.totalDeduction, 1578.42);
  });

  it("feeds the same audit KPIs payroll audit charts from parsed summaries", () => {
    const row = organicRegisterLineToAuditRow(claireLine());
    const totals = sumAuditMetricTotals({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      employeeCount: 1,
      hoursWorkedTotal: 0,
      regOTHoursTotal: 0,
      silTotal: 0,
      silCutoffTotal: 0,
      grossAmountTotal: 0,
      netAmountTotal: 0,
      totalOTAmount: 0,
      companyName: null,
      payoutDate: null,
      sourceFormat: "gp_hris",
      employees: [row],
    });

    assert.equal(totals.employeeCount, 1);
    assert.equal(totals.hoursWorked, 80);
    assert.equal(totals.totalSalary, 8000);
    assert.equal(totals.silAmount, 940.58);
    assert.equal(totals.holidayHours, 26);
    assert.equal(totals.holidayPay, 4140);
    assert.equal(totals.salaryLoan, 895.92);
    assert.equal(totals.totalOTHours, 24);
    assert.equal(totals.totalOTAmount, 5952.5);
  });

  it("returns an empty name and zeros when the line has no pay data", () => {
    const row = organicRegisterLineToAuditRow({});
    assert.equal(row.name, "");
    assert.equal(row.hoursWorked, 0);
    assert.equal(row.grossAmount, 0);
    assert.equal(row.netAmount, 0);
  });
});

describe("buildOrganicRegisterSummaryTable", () => {
  it("prints the payroll-audit register headers so the PDF can be projected", () => {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [claireLine()],
    });

    assert.deepEqual([...table.headers], [...PAYROLL_REGISTER_HEADERS]);
    assert.match(table.subtitle, /09\/16\/2026 to 09\/30\/2026/);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0][0], "Aban, Claire");
    assert.equal(table.rows[0][1], 800);
    assert.equal(table.rows[0][2], 80);
    assert.equal(table.totalsRow[0], "TOTAL");
    assert.equal(table.totalsRow[2], 80);
  });

  it("sums many lines on TOTAL and still prints headers with zero lines", () => {
    const empty = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [],
    });
    assert.equal(empty.rows.length, 0);
    assert.equal(empty.totalsRow[0], "TOTAL");
    assert.equal(empty.totalsRow[2], 0);

    const two = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [claireLine(), claireLine()],
    });
    assert.equal(two.rows.length, 2);
    assert.equal(two.totalsRow[2], 160);
    assert.equal(two.totalsRow[PAYROLL_REGISTER_HEADERS.indexOf("Gross Amount")], 23200);
  });
});
