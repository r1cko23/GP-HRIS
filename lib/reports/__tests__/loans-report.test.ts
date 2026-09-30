import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOANS_REPORT_HEADERS,
  LOANS_REPORT_TYPES,
  buildLoansReportCsv,
  explodeLoansReportRows,
  filterLoansReportRows,
  loansReportMatchesType,
  loansReportReviewKey,
  paginateLoansReportRows,
  type LoansReportSourceLine,
} from "../loans-report";

const sampleLines: LoansReportSourceLine[] = [
  {
    client_name: "IM Hotel",
    department: "FOH",
    employee_code: "E1",
    last_name: "Lamar",
    first_name: "Ana",
    middle_name: "M",
    date_of_birth: "1990-01-02",
    pagibig_no: "P1",
    sss_no: "S1",
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    payout_date: "2026-03-20",
    loan_lines: [
      { loan_type: "sss", particular: "SSS Loan", amount: 100 },
      { loan_type: "pagibig", particular: "Pag-IBIG Loan", amount: 200 },
      { loan_type: "other", particular: "Cash Advance", amount: 50 },
      { loan_type: "company", particular: "Company Loan", amount: 75 },
    ],
  },
  {
    client_name: "Organic",
    department: null,
    employee_code: "E2",
    last_name: "Cruz",
    first_name: "Ben",
    middle_name: null,
    date_of_birth: null,
    pagibig_no: "P2",
    sss_no: "S2",
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    payout_date: null,
    loan_lines: [
      { loan_type: "pagibig_mpl", particular: "Pag-IBIG MPL", amount: 300 },
      { loan_type: "pagibig_safe", particular: "Pag-IBIG Safe Loan", amount: 40 },
      { loan_type: "sss_calamity", particular: "SSS Calamity Loan", amount: 10 },
      { loan_type: "pagibig_calamity", particular: "Pag-IBIG Calamity Loan", amount: 15 },
      { loan_type: "pagibig_mpl", particular: "Pag-IBIG MPL", amount: 0 },
    ],
  },
];

describe("loansReportMatchesType", () => {
  it("treats legacy pagibig as MPL", () => {
    assert.equal(loansReportMatchesType("pagibig", "pagibig_mpl"), true);
    assert.equal(loansReportMatchesType("pagibig_mpl", "pagibig_mpl"), true);
    assert.equal(loansReportMatchesType("pagibig_safe", "pagibig_mpl"), false);
  });

  it("lists the five remittance types", () => {
    assert.deepEqual(LOANS_REPORT_TYPES, [
      "sss",
      "sss_calamity",
      "pagibig_mpl",
      "pagibig_calamity",
      "pagibig_safe",
    ]);
  });
});

describe("explodeLoansReportRows", () => {
  it("defaults to the five statutory types and skips zero / cash advance / company", () => {
    const rows = explodeLoansReportRows(sampleLines);
    assert.equal(rows.length, 6);
    assert.deepEqual(
      rows.map((r) => r.particular),
      [
        "SSS Loan",
        "Pag-IBIG Loan",
        "Pag-IBIG MPL",
        "Pag-IBIG Safe Loan",
        "SSS Calamity Loan",
        "Pag-IBIG Calamity Loan",
      ]
    );
    assert.equal(rows.some((r) => r.particular === "Cash Advance"), false);
  });

  it("filters Pag-IBIG MPL including legacy pagibig", () => {
    const rows = explodeLoansReportRows(sampleLines, { loan_type: "pagibig_mpl" });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].amount, 200);
    assert.equal(rows[1].amount, 300);
  });

  it("filters a single type", () => {
    const rows = explodeLoansReportRows(sampleLines, { loan_type: "sss_calamity" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].employee_code, "E2");
    assert.equal(rows[0].amount, 10);
  });
});

describe("filterLoansReportRows + paginate", () => {
  it("searches name / code and paginates", () => {
    const rows = explodeLoansReportRows(sampleLines);
    const hit = filterLoansReportRows(rows, { q: "cruz" });
    assert.equal(hit.length, 4);
    const page = paginateLoansReportRows(hit, 2, 2);
    assert.equal(page.length, 2);
    assert.equal(page[0].particular, "SSS Calamity Loan");
  });

  it("returns empty for no matches", () => {
    const rows = explodeLoansReportRows(sampleLines);
    assert.deepEqual(filterLoansReportRows(rows, { q: "zzz" }), []);
  });

  it("keeps posted lines that match an April review key", () => {
    const rows = explodeLoansReportRows(sampleLines);
    const keys = new Set([
      loansReportReviewKey("E2", "sss_calamity"),
      loansReportReviewKey("E1", "pagibig"),
    ]);
    const hit = filterLoansReportRows(rows, { review_keys: keys });
    assert.deepEqual(
      hit.map((row) => `${row.employee_code}:${row.loan_type}`),
      ["E1:pagibig_mpl", "E2:sss_calamity"]
    );
  });

  it("drops every row when the review set is empty", () => {
    const rows = explodeLoansReportRows(sampleLines);
    assert.deepEqual(filterLoansReportRows(rows, { review_keys: new Set() }), []);
  });
});

describe("buildLoansReportCsv", () => {
  it("uses MAIN SPlistofdeduction column order", () => {
    assert.deepEqual(LOANS_REPORT_HEADERS, [
      "company_name",
      "department",
      "employee_code",
      "last_name",
      "first_name",
      "middle_name",
      "date_of_birth",
      "pagibig_no",
      "sss_no",
      "amount",
      "period_start",
      "period_end",
      "payout_date",
      "particular",
    ]);
    const rows = explodeLoansReportRows(sampleLines, { loan_type: "sss" });
    const csv = buildLoansReportCsv(rows);
    const lines = csv.trim().split("\n");
    assert.equal(lines[0], LOANS_REPORT_HEADERS.join(","));
    assert.match(lines[1], /IM Hotel,FOH,E1,Lamar,Ana,M,1990-01-02,P1,S1,100,/);
  });
});

describe("MAIN remittance layout (loan PDF)", () => {
  it("formats employee name, cutoff, and title like List of Other Deduction", async () => {
    const {
      formatLoansRemittanceEmployeeName,
      formatLoansRemittanceCutoff,
      loansRemittanceTitle,
      groupLoansReportByCompany,
      buildLoansRemittanceCsv,
    } = await import("../loans-report");

    assert.equal(
      formatLoansRemittanceEmployeeName({
        last_name: "Bellen Jr",
        first_name: "Jose",
        middle_name: "Ferrer",
      }),
      "BELLEN JR, JOSE FERRER"
    );
    assert.equal(
      formatLoansRemittanceCutoff("2026-08-16", "2026-08-31"),
      "08/16/2026 to 08/31/2026"
    );
    assert.equal(loansRemittanceTitle("SSS Loan"), "List of Other Deduction(SSS Loan)");
    assert.equal(loansRemittanceTitle("sss"), "List of Other Deduction(SSS Loan)");

    const rows = explodeLoansReportRows(sampleLines, { loan_type: "sss" }).concat(
      explodeLoansReportRows(
        [
          {
            ...sampleLines[0],
            client_name: "CHICHA HUT FOOD CORP.",
            last_name: "Campanero",
            first_name: "Mark Angelo",
            middle_name: "Pagubayan",
            loan_lines: [{ loan_type: "sss", amount: 836.7 }],
          },
        ],
        { loan_type: "sss" }
      )
    );
    const grouped = groupLoansReportByCompany(rows);
    assert.equal(grouped.groups.length, 2);
    assert.equal(grouped.groups[0].company_name, "CHICHA HUT FOOD CORP.");
    assert.equal(grouped.groups[0].rows[0].row_no, 1);
    assert.equal(grouped.groups[1].company_name, "IM Hotel");
    assert.equal(grouped.groups[1].total, 100);
    assert.equal(grouped.grand_total, 936.7);

    const csv = buildLoansRemittanceCsv(rows, {
      dateFrom: "2026-08-20",
      dateTo: "2026-09-15",
      particular: "SSS Loan",
    });
    assert.match(csv, /^List of Other Deduction\(SSS Loan\)/);
    assert.match(csv, /Payout Date: 08\/20\/2026 to 09\/15\/2026/);
    assert.match(csv, /#,Employee Name,Birth Date,Company Name,Department\/Group,Payout Date,Cutoff,Particular,Amount,SSS Number/);
    assert.match(csv, /CHICHA HUT FOOD CORP\./);
    assert.match(csv, /Total:,836\.7/);
    assert.match(csv, /Grand Total:,936\.7/);
  });

  it("keeps non-zero loan amounts including negatives", async () => {
    const { explodeLoansReportRows: explode } = await import("../loans-report");
    const rows = explode([
      {
        client_name: "X",
        employee_code: "E9",
        last_name: "Neg",
        first_name: "One",
        loan_lines: [
          { loan_type: "sss", amount: -922.9 },
          { loan_type: "sss", amount: 0 },
        ],
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, -922.9);
  });
});
