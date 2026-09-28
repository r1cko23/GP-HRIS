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
    assert.equal(breakdown.earnings.items[0]?.key, "salaries_and_wages");
    assert.equal(breakdown.earnings.items[1]?.key, "refund");
    assert.equal(breakdown.earnings.items[1]?.amount, 0);
    assert.equal(breakdown.earnings.items[2]?.amount, 0); // cash in bank
    assert.equal(breakdown.earnings.items[3]?.amount, 10021.58); // salary credit
    assert.equal(breakdown.earnings.items[4]?.amount, 0); // gcash

    assert.equal(breakdown.deductions.items[0]?.amount, 200);
    assert.equal(breakdown.deductions.items[1]?.amount, 695.92);
    assert.equal(breakdown.deductions.items[2]?.amount, 387.5);
    assert.equal(breakdown.deductions.items[6]?.amount, 50);
    assert.equal(breakdown.deductions.items[6]?.key, "other_deduction");
    assert.equal(breakdown.deductions.items[6]?.label, "Other deduction");

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

  it("shows zero employer share when register lines omit ER fields", () => {
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

    assert.equal(breakdown.employerShare.items[0]?.amount, 0);
    assert.equal(breakdown.employerShare.items[4]?.amount, 0);
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

  it("itemizes other deductions by particular and keeps residual Other", () => {
    const line = {
      ...claireLine(),
      deductions: {
        ...claireLine().deductions,
        other: 280,
      },
      other_deduction_lines: [
        {
          key: "personal_accident",
          particular: "Personal Accident",
          amount: 50,
        },
        { key: "hmo", particular: "HMO", amount: 200 },
        { key: "uniform", particular: "Uniform", amount: 30 },
      ],
    };
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [line],
      periodEnd: "2026-09-30",
    });
    const byKey = Object.fromEntries(
      breakdown.deductions.items.map((i) => [i.key, i])
    );
    assert.equal(byKey.personal_accident?.label, "Personal Accident");
    assert.equal(byKey.personal_accident?.amount, 50);
    assert.equal(byKey.hmo?.amount, 200);
    assert.equal(byKey.uniform?.amount, 30);
    assert.equal(
      byKey.other_deduction,
      undefined,
      "fully itemized other should not keep a residual Other line"
    );
  });

  it("puts Benefits refund under Earnings (not deductions)", () => {
    const line = {
      ...claireLine(),
      gross_pay: 11850.5,
      earnings: {
        ...claireLine().earnings,
        adjustment: 250.5,
      },
    };
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [line],
      periodEnd: "2026-09-30",
    });
    const earningsByKey = Object.fromEntries(
      breakdown.earnings.items.map((i) => [i.key, i])
    );
    assert.equal(earningsByKey.refund?.label, "Refund");
    assert.equal(earningsByKey.refund?.amount, 250.5);
    assert.equal(earningsByKey.salaries_and_wages?.amount, 11850.5);
    const deductionKeys = breakdown.deductions.items.map((i) => i.key);
    assert.equal(deductionKeys.includes("refund"), false);
  });

  it("puts TL / Load / Supervisory allowances under Earnings (not Allow. lump only)", () => {
    const line = {
      ...claireLine(),
      gross_pay: 12450,
      earnings: {
        ...claireLine().earnings,
        allowance: 1050,
      },
      allowance_lines: [
        { key: "tl_allowance", particular: "TL allowance", amount: 500 },
        { key: "load_allowance", particular: "Load allowance", amount: 200 },
        {
          key: "supervisory_allowance",
          particular: "Supervisory allowance",
          amount: 150,
        },
      ],
    };
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [line],
      periodEnd: "2026-09-30",
    });
    const earningsByKey = Object.fromEntries(
      breakdown.earnings.items.map((i) => [i.key, i])
    );
    assert.equal(earningsByKey.tl_allowance?.label, "TL allowance");
    assert.equal(earningsByKey.tl_allowance?.amount, 500);
    assert.equal(earningsByKey.load_allowance?.amount, 200);
    assert.equal(earningsByKey.supervisory_allowance?.amount, 150);
    assert.equal(earningsByKey.allowance?.amount, 200); // residual COLA in claireLine
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
