import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCutoffSummaryBreakdown,
  fundingPeopleFromRegisterLines,
} from "../cutoff-summary-breakdown";

const round2 = (n: number) => Math.round(n * 100) / 100;

function claireLine() {
  return {
    directory_employee_id: "dir-claire",
    last_name: "Aban",
    first_name: "Claire",
    daily_rate: 800,
    monthly_salary: 20800,
    gross_pay: 11600,
    total_deductions: 1578.42,
    net_pay: 10021.58,
    hours: { actual_regular_hours: 80, overtime_hours: 8 },
    earnings: { basic: 8000, overtime: 1000, days_work: 11 },
    deductions: {
      sss: 387.5,
      sss_wisp: 50,
      sss_er: 775,
      sss_wisp_er: 25,
      sss_ecc: 10,
      philhealth: 195,
      philhealth_er: 195,
      pagibig: 100,
      pagibig_er: 100,
      withholding_tax: 0,
      loans: 895.92,
      other: 50,
    },
    loan_lines: [
      { loan_type: "sss", amount: 200 },
      { loan_type: "pagibig", amount: 695.92 },
    ],
  };
}

describe("buildCutoffSummaryBreakdown", () => {
  it("groups register totals into MAIN-style footer sections", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [claireLine()],
      periodEnd: "2026-09-30",
      fundingPeople: [
        {
          last_name: "Aban",
          first_name: "Claire",
          net_pay: 10021.58,
          pay_through: "atm",
        },
      ],
    });

    assert.equal(breakdown.earnings.items[0]?.amount, 11600);
    assert.equal(breakdown.earnings.items[1]?.amount, 0);
    assert.equal(breakdown.earnings.items[2]?.amount, 10021.58);
    assert.equal(breakdown.earnings.items[3]?.amount, 0);

    assert.equal(breakdown.deductions.items[0]?.amount, 200);
    assert.equal(breakdown.deductions.items[1]?.amount, 695.92);
    assert.equal(breakdown.deductions.items[2]?.amount, 387.5);
    assert.equal(breakdown.deductions.items[6]?.amount, 50);

    assert.equal(breakdown.employeeShare.items[0]?.amount, 387.5);
    assert.equal(breakdown.employerShare.items[0]?.amount, 775);
    assert.equal(breakdown.employerShare.items[1]?.amount, 25);
    assert.equal(breakdown.employerShare.items[2]?.amount, 10);
  });

  it("uses MAIN catalog employer shares when stored on register lines", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [
        {
          last_name: "Test",
          first_name: "Employee",
          monthly_salary: 18070,
          gross_pay: 8791.75,
          net_pay: 8182.37,
          earnings: { basic: 8340, days_work: 12 },
          deductions: {
            sss: 425,
            philhealth: 184.38,
            pagibig: 0,
            sss_er: 850,
            sss_ecc: 10,
            philhealth_er: 184.38,
            pagibig_er: 100,
            withholding_tax: 0,
            loans: 0,
            other: 0,
          },
        },
      ],
      periodEnd: "2026-08-31",
    });

    assert.equal(breakdown.employerShare.items[0]?.amount, 850);
    assert.equal(breakdown.employerShare.items[2]?.amount, 10);
    assert.equal(breakdown.employerShare.items[3]?.amount, 100);
    assert.equal(breakdown.employerShare.items[4]?.amount, 184.38);
  });

  it("computes employer share from monthly salary when catalog lines omit ER fields", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [
        {
          last_name: "Test",
          first_name: "Employee",
          monthly_salary: 18070,
          gross_pay: 8791.75,
          net_pay: 8182.37,
          earnings: { basic: 8340, days_work: 12 },
          deductions: {
            sss: 425,
            philhealth: 184.38,
            pagibig: 0,
            withholding_tax: 0,
            loans: 0,
            other: 0,
          },
        },
      ],
      periodEnd: "2026-08-31",
    });

    assert.ok(breakdown.employerShare.items[0]!.amount > 0);
    assert.ok(breakdown.employerShare.items[4]!.amount > 0);
    assert.equal(breakdown.employeeShare.items[0]?.amount, 425);
  });

  it("sums accrual cutoffs across many lines", () => {
    const line = claireLine();
    const single = buildCutoffSummaryBreakdown({
      lines: [line],
      periodEnd: "2026-09-30",
    });
    const doubled = buildCutoffSummaryBreakdown({
      lines: [line, line],
      periodEnd: "2026-09-30",
    });

    assert.equal(
      doubled.accruals13th.items[0]?.amount,
      round2((single.accruals13th.items[0]?.amount ?? 0) * 2)
    );
    assert.equal(
      doubled.accrualsSil.items[0]?.amount,
      round2((single.accrualsSil.items[0]?.amount ?? 0) * 2)
    );
  });
});

describe("fundingPeopleFromRegisterLines", () => {
  it("joins Directory pay-through onto register net pay", () => {
    const people = fundingPeopleFromRegisterLines(
      [
        {
          directory_employee_id: "dir-1",
          last_name: "Aban",
          first_name: "Claire",
          net_pay: 100,
        },
      ],
      new Map([["dir-1", { pay_through: "gcash", gcash: "09171234567" }]])
    );

    assert.equal(people[0]?.pay_through, "gcash");
    assert.equal(people[0]?.net_pay, 100);
  });
});
