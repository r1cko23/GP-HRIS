import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCutoffSummaryBreakdown } from "../cutoff-summary-breakdown";
import { summaryBreakdownPdfGrid } from "../render-summary-breakdown-pdf";

describe("summaryBreakdownPdfGrid", () => {
  it("lays out six summary columns with label and amount rows", () => {
    const breakdown = buildCutoffSummaryBreakdown({
      lines: [
        {
          last_name: "Aban",
          first_name: "Claire",
          monthly_salary: 20800,
          gross_pay: 11600,
          net_pay: 10021.58,
          earnings: { basic: 8000, days_work: 11 },
          deductions: {
            sss: 387.5,
            philhealth: 195,
            pagibig: 100,
            withholding_tax: 0,
            loans: 0,
            other: 0,
          },
        },
      ],
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

    const grid = summaryBreakdownPdfGrid(breakdown);
    assert.equal(grid.headers.length, 6);
    assert.equal(grid.headers[0], "Earnings");
    assert.match(grid.rows[0]![0]!, /Salaries and wages: 11,600\.00/);
    assert.match(grid.rows[0]![2]!, /SSS: 387\.50/);
  });
});
