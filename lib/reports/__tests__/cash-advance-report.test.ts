import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOANS_REPORT_HEADERS,
  buildLoansReportCsv,
  explodeCashAdvanceReportRows,
  filterLoansReportRows,
  isCashAdvanceLoanLine,
  type LoansReportSourceLine,
} from "../loans-report";

const sampleLines: LoansReportSourceLine[] = [
  {
    client_name: "Green Pasture People Management Inc.",
    employee_code: "E1",
    last_name: "Abarra",
    first_name: "Angelique",
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    payout_date: "2026-03-20",
    loan_lines: [
      { loan_type: "other", particular: "Cash Advance", amount: 1500 },
      { loan_type: "sss", particular: "SSS Loan", amount: 100 },
      { loan_type: "company", particular: "Company Loan", amount: 200 },
      { loan_type: "other", particular: "Cash Advance", amount: 0 },
    ],
  },
  {
    client_name: "Organic",
    employee_code: "E2",
    last_name: "Cruz",
    first_name: "Ben",
    period_start: "2026-03-01",
    period_end: "2026-03-15",
    loan_lines: [
      { loan_type: "emergency", particular: "Emergency Loan", amount: 50 },
      {
        loan_type: "other",
        particular: "cash advance - special",
        amount: 250,
      },
    ],
  },
];

describe("isCashAdvanceLoanLine", () => {
  it("matches other + Cash Advance particular, or cash-advance text", () => {
    assert.equal(
      isCashAdvanceLoanLine({ loan_type: "other", particular: "Cash Advance" }),
      true
    );
    assert.equal(
      isCashAdvanceLoanLine({
        loan_type: "other",
        particular: "cash advance - special",
      }),
      true
    );
    assert.equal(
      isCashAdvanceLoanLine({ loan_type: "sss", particular: "SSS Loan" }),
      false
    );
    assert.equal(
      isCashAdvanceLoanLine({ loan_type: "other", particular: "Misc" }),
      false
    );
  });
});

describe("explodeCashAdvanceReportRows", () => {
  it("keeps only cash advances and skips zero / statutory / company", () => {
    const rows = explodeCashAdvanceReportRows(sampleLines);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => ({ code: r.employee_code, amount: r.amount })),
      [
        { code: "E1", amount: 1500 },
        { code: "E2", amount: 250 },
      ]
    );
    assert.equal(
      rows.every((r) => /cash advance/i.test(r.particular)),
      true
    );
  });

  it("builds CSV with the same MAIN deduction columns", () => {
    const rows = explodeCashAdvanceReportRows(sampleLines);
    const filtered = filterLoansReportRows(rows, { q: "abarra" });
    assert.equal(filtered.length, 1);
    const csv = buildLoansReportCsv(filtered);
    assert.equal(csv.trim().split("\n")[0], LOANS_REPORT_HEADERS.join(","));
    assert.match(csv, /Cash Advance/);
  });
});
