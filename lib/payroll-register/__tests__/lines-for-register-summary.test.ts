import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  linesForRegisterSummary,
  registerListFiltersActive,
} from "../lines-for-register-summary";
import { summarizeRegisterLines } from "../compute";

describe("registerListFiltersActive", () => {
  it("is false for empty search and All employees", () => {
    assert.equal(registerListFiltersActive({ q: "", payFilter: "all" }), false);
    assert.equal(registerListFiltersActive({}), false);
  });

  it("is true when search or a deduction filter is on", () => {
    assert.equal(registerListFiltersActive({ q: "Gayo" }), true);
    assert.equal(
      registerListFiltersActive({ q: "  ", payFilter: "loans" }),
      true
    );
  });
});

describe("linesForRegisterSummary", () => {
  const all = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const matching = [{ id: "b" }];

  it("uses matching lines when filters are active", () => {
    assert.deepEqual(
      linesForRegisterSummary({
        filtersActive: true,
        matchingLines: matching,
        allLines: all,
      }),
      matching
    );
  });

  it("uses the full run when filters are off", () => {
    assert.deepEqual(
      linesForRegisterSummary({
        filtersActive: false,
        matchingLines: matching,
        allLines: all,
      }),
      all
    );
  });

  it("filtered summarize totals match the one searched employee", () => {
    const lines = [
      {
        gross_pay: 10000,
        total_deductions: 800,
        net_pay: 9200,
        deductions: { sss: 350, philhealth: 250, pagibig: 200, loans: 0, other: 0, withholding_tax: 0 },
        earnings: { adjustment: 0 },
      },
      {
        gross_pay: 11280.29,
        total_deductions: 771.12,
        net_pay: 10509.17,
        deductions: {
          sss: 425,
          philhealth: 250,
          pagibig: 200,
          loans: -103.88,
          other: 0,
          withholding_tax: 0,
        },
        earnings: { adjustment: 180.32 },
      },
    ] as any;
    const filtered = linesForRegisterSummary({
      filtersActive: true,
      matchingLines: [lines[1]!],
      allLines: lines,
    });
    const totals = summarizeRegisterLines(filtered);
    assert.equal(totals.line_count, 1);
    assert.equal(totals.gross_pay, 11280.29);
    assert.equal(totals.net_pay, 10509.17);
    assert.equal(totals.adjustment, 180.32);
  });
});
