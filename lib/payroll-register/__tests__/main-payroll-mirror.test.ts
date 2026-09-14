import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mainHoursToCutoffRow } from "../main-hours-to-cutoff-row";
import {
  isMainLoanOtherDeduction,
  mainCatalogRunTotals,
  mainSummaryRowsToRegisterLine,
} from "../main-summary-to-register-line";
import { planMainPayrollMirror } from "../plan-main-payroll-mirror";

const ORGANIC_CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

/** Claire Aban, Nabati Batangas Aug 16–31 from live MAIN. */
function claireSummaryRow(overrides: Record<string, unknown> = {}) {
  return {
    Employee_id: 12345,
    last_name: "Aban",
    first_name: "Claire",
    Date_Start: "2026-08-16",
    Date_End: "2026-08-31",
    basic: 7800,
    grossalary: 10400,
    Totaldeduction: 1800,
    netamount: 8600,
    contributionSSSEE: 425,
    contributionphilhealthEE: 195,
    contributionPagibigEE: 100,
    Wtax: 0,
    Salary_Loan: 0,
    Pagibig_Loan: 895.92,
    Other_Deduction: 184.08,
    dailyrate_payroll: 600,
    Regular_Days: 13,
    actualregularhours: 104,
    Overtime_Hours: 0,
    Nightdiff_Hours: 0,
    thirteenmonth: 650,
    ytdthirteenmonth: 12200,
    silp: 124.6,
    payrollatmno: "1234567890",
    empbankname: "BDO",
    ...overrides,
  };
}

describe("mainSummaryRowsToRegisterLine", () => {
  it("maps Claire Aug 16–31 MAIN pesos onto a GP register line", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      officeEmployeeId: null,
      employeeCode: "202309-00023",
      rows: [claireSummaryRow()],
    });
    assert.equal(line.directory_employee_id, "claire-dir");
    assert.equal(line.last_name, "Aban");
    assert.equal(line.first_name, "Claire");
    assert.equal(line.daily_rate, 600);
    assert.equal(line.gross_pay, 10400);
    assert.equal(line.total_deductions, 1800);
    assert.equal(line.net_pay, 8600);
    assert.equal(line.earnings.basic, 7800);
    assert.equal(line.earnings.thirteenth_month, 650);
    assert.equal(line.earnings.thirteenth_month_ytd, 12200);
    assert.equal(line.earnings.sil_cutoff, 124.6);
    assert.equal(line.deductions.sss, 425);
    assert.equal(line.deductions.philhealth, 195);
    assert.equal(line.deductions.pagibig, 100);
    assert.equal(line.deductions.loans, 895.92);
    assert.equal(line.deductions.other, 184.08);
    assert.equal(line.hours.actual_regular_hours, 104);
    assert.equal(line.bank_name, "BDO");
    assert.equal(line.bank_account_no, "1234567890");
  });

  it("collapses two MAIN rows for the same person into one GP line", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "person-1",
      officeEmployeeId: null,
      employeeCode: null,
      rows: [
        claireSummaryRow({
          basic: 4000,
          grossalary: 5000,
          Totaldeduction: 500,
          netamount: 4500,
          contributionSSSEE: 200,
          Pagibig_Loan: 100,
          Other_Deduction: 0,
          actualregularhours: 52,
        }),
        claireSummaryRow({
          basic: 3800,
          grossalary: 5400,
          Totaldeduction: 1300,
          netamount: 4100,
          contributionSSSEE: 225,
          Pagibig_Loan: 795.92,
          Other_Deduction: 184.08,
          actualregularhours: 52,
          thirteenmonth: 316.67,
          ytdthirteenmonth: 12200,
          silp: 62.3,
        }),
      ],
    });
    assert.equal(line.gross_pay, 10400);
    assert.equal(line.total_deductions, 1800);
    assert.equal(line.net_pay, 8600);
    assert.equal(line.earnings.basic, 7800);
    assert.equal(line.deductions.sss, 425);
    assert.equal(line.deductions.loans, 895.92);
    assert.equal(line.deductions.other, 184.08);
    assert.equal(line.hours.actual_regular_hours, 104);
    assert.equal(line.earnings.thirteenth_month_ytd, 12200);
  });
});

describe("mainCatalogRunTotals", () => {
  it("puts statutory and Pag-IBIG loan on the run totals the summary card reads", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      officeEmployeeId: null,
      employeeCode: "202309-00023",
      rows: [claireSummaryRow()],
    });
    const totals = mainCatalogRunTotals([line]);
    assert.equal(totals.sss, 425);
    assert.equal(totals.philhealth, 195);
    assert.equal(totals.pagibig, 100);
    assert.equal(totals.withholding_tax, 0);
    assert.equal(totals.loans, 895.92);
    assert.equal(totals.other, 184.08);
    assert.equal(totals.gross_pay, 10400);
    assert.equal(totals.net_pay, 8600);
  });

  it("sums two people and stays zero with no lines", () => {
    const claire = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      rows: [claireSummaryRow()],
    });
    const ana = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "ana-dir",
      rows: [
        claireSummaryRow({
          last_name: "Reyes",
          first_name: "Ana",
          contributionSSSEE: 200,
          contributionphilhealthEE: 100,
          contributionPagibigEE: 50,
          Pagibig_Loan: 0,
          Salary_Loan: 400,
          Other_Deduction: 0,
          grossalary: 8000,
          netamount: 7250,
          Totaldeduction: 750,
        }),
      ],
    });
    const totals = mainCatalogRunTotals([claire, ana]);
    assert.equal(totals.line_count, 2);
    assert.equal(totals.sss, 625);
    assert.equal(totals.loans, 1295.92);
    assert.equal(totals.gross_pay, 18400);

    const empty = mainCatalogRunTotals([]);
    assert.equal(empty.line_count, 0);
    assert.equal(empty.sss, 0);
    assert.equal(empty.loans, 0);
    assert.equal(empty.other, 0);
  });

  it("splits tagged otherdeduction loans from cash advance and keeps MAIN particulars", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      rows: [
        claireSummaryRow({
          Pagibig_Loan: 0,
          Salary_Loan: 0,
          Other_Deduction: 1080,
        }),
      ],
      otherDeductions: [
        {
          particular: "Pag-ibig Loan",
          amount: 895.92,
          idloanschedule: 44,
          idloan: 9,
        },
        { particular: "Cash Advance", amount: 184.08 },
      ],
    });
    assert.equal(line.deductions.loans, 895.92);
    assert.equal(line.deductions.other, 184.08);
    assert.equal(line.loan_lines.length, 1);
    assert.equal(line.loan_lines[0]?.particular, "Pag-ibig Loan");
    assert.equal(line.loan_lines[0]?.loan_type, "pagibig");
    assert.equal(line.loan_lines[0]?.amount, 895.92);
    const totals = mainCatalogRunTotals([line]);
    assert.equal(totals.loans, 895.92);
    assert.equal(totals.other, 184.08);
  });

  it("sums two tagged loan rows of the same particular", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      rows: [claireSummaryRow({ Pagibig_Loan: 0, Other_Deduction: 0 })],
      otherDeductions: [
        { particular: "Pag-ibig Loan", amount: 100, idloanschedule: 1 },
        { particular: "Pag-ibig Loan", amount: 795.92, idloanschedule: 2 },
      ],
    });
    assert.equal(line.deductions.loans, 895.92);
    assert.equal(line.loan_lines.length, 1);
    assert.equal(line.loan_lines[0]?.amount, 895.92);
  });

  it("treats an empty otherdeduction list as no child rows and uses summary loan columns", () => {
    const line = mainSummaryRowsToRegisterLine({
      directoryEmployeeId: "claire-dir",
      rows: [claireSummaryRow()],
      otherDeductions: [],
    });
    assert.equal(line.deductions.loans, 895.92);
    assert.equal(line.deductions.other, 184.08);
  });
});

describe("isMainLoanOtherDeduction", () => {
  it("tags loan-process rows and loan particulars, not cash advance or vale", () => {
    assert.equal(
      isMainLoanOtherDeduction({ idloanschedule: 12, particular: "Misc" }),
      true
    );
    assert.equal(
      isMainLoanOtherDeduction({ idloan: 3, particular: "Salary Loan" }),
      true
    );
    assert.equal(isMainLoanOtherDeduction({ particular: "SSS Loan" }), true);
    assert.equal(
      isMainLoanOtherDeduction({ particular: "Pag-ibig Loan" }),
      true
    );
    assert.equal(
      isMainLoanOtherDeduction({ particular: "Cash Advance" }),
      false
    );
    assert.equal(isMainLoanOtherDeduction({ particular: "Vale" }), false);
    assert.equal(isMainLoanOtherDeduction({ particular: "" }), false);
  });
});

describe("mainHoursToCutoffRow", () => {
  it("maps tbl_timekeep-style hours onto cutoff_hours with GREENHRISMAIN source", () => {
    const row = mainHoursToCutoffRow({
      directoryEmployeeId: "claire-dir",
      officeEmployeeId: null,
      branchId: "batangas",
      positionId: null,
      employeeCode: "202309-00023",
      lastName: "Aban",
      firstName: "Claire",
      source: {
        actualregularhours: 104,
        noofhourswork: 104,
        Overtime_Hours: 8,
        Nightdiff_Hours: 4,
        dailyrate_payroll: 600,
        idtimekeep: 999,
      },
    });
    assert.equal(row.directory_employee_id, "claire-dir");
    assert.equal(row.actual_regular_hours, 104);
    assert.equal(row.overtime_hours, 8);
    assert.equal(row.night_diff_hours, 4);
    assert.equal(row.daily_rate_payroll, 600);
    assert.equal(row.source_of_data, "GREENHRISMAIN");
    assert.equal(row.legacy_idtimekeep, 999);
  });

  it("falls back to payroll_summary hour columns when timekeep is absent", () => {
    const row = mainHoursToCutoffRow({
      directoryEmployeeId: "organic-1",
      officeEmployeeId: "office-1",
      branchId: null,
      positionId: null,
      employeeCode: null,
      lastName: "Reyes",
      firstName: "Ana",
      source: claireSummaryRow({
        actualregularhours: 0,
        noofhourswork: 80,
        Overtime_Hours: 2,
      }),
    });
    assert.equal(row.actual_regular_hours, 80);
    assert.equal(row.overtime_hours, 2);
    assert.equal(row.source_of_data, "GREENHRISMAIN");
  });
});

describe("planMainPayrollMirror", () => {
  it("skips Organic house cutoffs that are already posted in GP", () => {
    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: 173,
        legacyBranchId: null,
        periodStart: "2026-07-01",
        periodEnd: "2026-07-15",
      },
      directoryClientId: ORGANIC_CLIENT_ID,
      directoryBranchId: null,
      existingCutoff: {
        id: "organic-jul",
        status: "posted",
        source_app: "gp-hris-organic",
      },
      existingRun: {
        id: "run-1",
        status: "posted",
        notes: "Organic golden",
      },
    });
    assert.equal(plan.action, "skip_organic_posted");
  });

  it("creates a catalog period when Directory resolves and GP has none", () => {
    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: 130,
        legacyBranchId: 42,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
      },
      directoryClientId: "nabati",
      directoryBranchId: "batangas",
      existingCutoff: null,
      existingRun: null,
    });
    assert.equal(plan.action, "create");
  });

  it("replaces an existing catalog run on re-import", () => {
    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: 130,
        legacyBranchId: 42,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
      },
      directoryClientId: "nabati",
      directoryBranchId: "batangas",
      existingCutoff: {
        id: "c1",
        status: "posted",
        source_app: "greenhrismain-catalog",
      },
      existingRun: {
        id: "r1",
        status: "posted",
        notes: "MAIN catalog import 2026",
      },
    });
    assert.equal(plan.action, "replace_catalog_run");
  });

  it("upserts hours and replaces non-catalog draft/approved trial cutoffs", () => {
    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: 130,
        legacyBranchId: 42,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
      },
      directoryClientId: "nabati",
      directoryBranchId: "batangas",
      existingCutoff: {
        id: "c1",
        status: "approved",
        source_app: "gp-payroll-timekeeping-attendance",
      },
      existingRun: null,
    });
    assert.equal(plan.action, "upsert_hours");
  });

  it("skips when Directory client cannot be resolved", () => {
    const plan = planMainPayrollMirror({
      organicClientId: ORGANIC_CLIENT_ID,
      mainPeriod: {
        legacyClientId: 999,
        legacyBranchId: 1,
        periodStart: "2026-01-01",
        periodEnd: "2026-01-15",
      },
      directoryClientId: null,
      directoryBranchId: null,
      existingCutoff: null,
      existingRun: null,
    });
    assert.equal(plan.action, "skip_no_directory");
  });
});
