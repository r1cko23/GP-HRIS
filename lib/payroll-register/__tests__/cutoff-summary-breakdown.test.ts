import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCutoffSummaryBreakdown,
  fundingPeopleFromRegisterLines,
  orderedCutoffSummarySections,
} from "../cutoff-summary-breakdown";
import { linesForRegisterSummary } from "../lines-for-register-summary";

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

    const dedByKey = Object.fromEntries(
      breakdown.deductions.items.map((i) => [i.key, i])
    );
    assert.equal(dedByKey.sss_loan?.amount, 200);
    assert.equal(dedByKey.sss_calamity_loan?.amount, 0);
    assert.equal(dedByKey.pagibig_loan?.amount, 695.92);
    assert.equal(dedByKey.pagibig_calamity_loan?.amount, 0);
    assert.equal(dedByKey.sss?.amount, 387.5);
    assert.equal(dedByKey.other_deduction?.amount, 50);
    assert.equal(dedByKey.other_deduction?.label, "Other deduction");

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

  it("lists SSS/Pag-IBIG salary and calamity loans as separate deduction rows", () => {
    const line = {
      ...claireLine(),
      deductions: {
        ...claireLine().deductions,
        loans: 2489.28,
        other: 0,
      },
      loan_lines: [
        { loan_type: "sss", amount: 791.48 },
        { loan_type: "sss_calamity", amount: 805.91 },
        { loan_type: "pagibig", amount: 417.58 },
        { loan_type: "pagibig_calamity", amount: 474.31 },
        { loan_type: "other", particular: "HMO", amount: 180.32 },
      ],
    };
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [line],
      periodEnd: "2026-09-25",
    });
    const byKey = Object.fromEntries(
      breakdown.deductions.items.map((i) => [i.key, i])
    );
    assert.equal(byKey.sss_loan?.label, "SSS loan");
    assert.equal(byKey.sss_loan?.amount, 791.48);
    assert.equal(byKey.sss_calamity_loan?.label, "SSS calamity loan");
    assert.equal(byKey.sss_calamity_loan?.amount, 805.91);
    assert.equal(byKey.pagibig_loan?.label, "Pag-IBIG loan");
    assert.equal(byKey.pagibig_loan?.amount, 417.58);
    assert.equal(byKey.pagibig_calamity_loan?.label, "Pag-IBIG calamity loan");
    assert.equal(byKey.pagibig_calamity_loan?.amount, 474.31);
    assert.equal(
      byKey.other_deduction?.amount,
      180.32,
      "HMO on loan_lines stays under Other, not a loan row"
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

  it("routes negative MAIN loan_lines to Refund and keeps positive Other (does not drop credits)", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [
        {
          last_name: "Gayo",
          first_name: "Mica",
          gross_pay: 11280.29,
          total_deductions: 771.12,
          net_pay: 10509.17,
          earnings: { basic: 8250.52 },
          deductions: {
            sss: 425,
            philhealth: 250,
            pagibig: 200,
            loans: -103.88,
            other: 0,
          },
          loan_lines: [
            { loan_type: "other", particular: "HMO", amount: -180.32 },
            {
              loan_type: "other",
              particular: "Other Deduction",
              amount: 76.44,
            },
          ],
        },
        {
          last_name: "Parcutela",
          first_name: "John Carlo",
          gross_pay: 11476.2,
          total_deductions: 694.68,
          net_pay: 10781.52,
          earnings: { basic: 8340 },
          deductions: {
            sss: 425,
            philhealth: 250,
            pagibig: 200,
            loans: -180.32,
            other: 0,
          },
          loan_lines: [
            { loan_type: "other", particular: "HMO", amount: -180.32 },
          ],
        },
      ],
      periodEnd: "2026-09-15",
    });
    const earningsByKey = Object.fromEntries(
      breakdown.earnings.items.map((i) => [i.key, i])
    );
    const dedByKey = Object.fromEntries(
      breakdown.deductions.items.map((i) => [i.key, i])
    );
    assert.equal(earningsByKey.refund?.amount, 360.64);
    assert.equal(dedByKey.other_deduction?.amount, 76.44);
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

  it("register search keeps that employee's YTD and SIL accrual in the summary", () => {
    const claire = claireLine();
    const other = {
      ...claireLine(),
      last_name: "Castor",
      first_name: "Mark Lester",
      directory_employee_id: "dir-castor",
      gross_pay: 680.23,
      net_pay: 680.23,
      total_deductions: 0,
      daily_rate: 600,
      earnings: { basic: 680.23, days_work: 1 },
      deductions: {
        sss: 0,
        philhealth: 0,
        pagibig: 0,
        withholding_tax: 0,
        loans: 0,
        other: 0,
      },
      loan_lines: [],
    };
    const mainScrape = {
      periodEnd: "2026-09-30",
      employees: [
        {
          name: "Aban, Claire",
          thirteenthMonthCutoff: 900,
          thirteenthMonthYTD: 12200,
          silCutoff: 400,
        },
        {
          name: "Castor, Mark Lester",
          thirteenthMonthCutoff: 50,
          thirteenthMonthYTD: 2715.4,
          silCutoff: 133.23,
        },
      ],
    };
    const matching = linesForRegisterSummary({
      filtersActive: true,
      matchingLines: [other],
      allLines: [claire, other],
    });
    const breakdown = buildCutoffSummaryBreakdown({
      lines: matching,
      periodEnd: "2026-09-30",
      mainScrape,
    });
    const ytd = breakdown.accruals13th.items.find((i) => i.key === "ytd");
    const sil = breakdown.accrualsSil.items.find((i) => i.key === "cutoff");
    assert.equal(ytd?.amount, 2715.4);
    // SIL cutoff accrual = days/313 × 5 × daily rate for this kinsena
    assert.equal(sil?.amount, 9.58);
    assert.notEqual(
      ytd?.amount,
      12200 + 2715.4,
      "full-run YTD must not leak into a one-employee search"
    );
  });
});

describe("orderedCutoffSummarySections", () => {
  it("leads with YTD and SIL accruals when register search is active", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [claireLine()],
      periodEnd: "2026-09-30",
    });
    const filtered = orderedCutoffSummarySections(breakdown, {
      prioritizeAccruals: true,
    });
    assert.deepEqual(
      filtered.map((s) => s.title),
      [
        "Accruals — 13th month",
        "Accruals — SIL",
        "Earnings",
        "Deductions",
        "Employee share",
        "Employer share",
      ]
    );
    const plain = orderedCutoffSummarySections(breakdown, {
      prioritizeAccruals: false,
    });
    assert.equal(plain[0]?.title, "Earnings");
  });
});

describe("fundingPeopleFromRegisterLines", () => {
  it("joins Directory pay-through onto register net pay when line has none", () => {
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

  it("prefers line pay_through/gcash/bank over live Directory", () => {
    const people = fundingPeopleFromRegisterLines(
      [
        {
          directory_employee_id: "dir-1",
          last_name: "Galvez",
          first_name: "Jerico",
          net_pay: 5000,
          pay_through: "Atm",
          bank_account_no: "002110286187",
          gcash: null,
        },
      ],
      new Map([
        [
          "dir-1",
          {
            pay_through: "GCash",
            gcash: "09657438855",
            bank_account_no: "999999",
          },
        ],
      ])
    );

    assert.equal(people[0]?.pay_through, "Atm");
    assert.equal(people[0]?.bank_account_no, "002110286187");
    assert.equal(people[0]?.gcash, null);
  });
});
