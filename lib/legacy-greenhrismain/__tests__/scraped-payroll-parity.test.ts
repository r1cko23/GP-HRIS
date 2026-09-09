import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareRegisterToScrapedSummary } from "../payroll-summary-parity";

describe("compareRegisterToScrapedSummary", () => {
  it("matches GP register names to scraped GREENHRISMAIN PDF employees", () => {
    const { rows, summary } = compareRegisterToScrapedSummary({
      gpLines: [
        {
          directory_employee_id: "dir-aban",
          employee_code: "202401-00001",
          last_name: "Aban",
          first_name: "Claire",
          gross_pay: 12198.58,
          net_pay: 0,
          deductions: { sss: 425, philhealth: 0, pagibig: 155 },
        },
      ],
      scraped: [
        {
          name: "ABAN, CLAIRE U.",
          gross: 12198.58,
          net: 0,
          sss: 425,
          philhealth: 0,
          pagibig: 155,
        },
      ],
    });
    assert.equal(rows[0].status, "match");
    assert.equal(summary.match, 1);
    assert.equal(summary.scraped_only, 0);
  });

  it("flags amount mismatch on a name hit", () => {
    const { rows } = compareRegisterToScrapedSummary({
      gpLines: [
        {
          directory_employee_id: "dir-1",
          employee_code: null,
          last_name: "Aban",
          first_name: "Claire",
          gross_pay: 100,
          net_pay: 80,
          deductions: {},
        },
      ],
      scraped: [{ name: "ABAN, CLAIRE U.", gross: 12198.58, net: 0 }],
    });
    assert.equal(rows[0].status, "mismatch");
    assert.equal(rows[0].delta.gross, -12098.58);
  });

  it("pairs Cadacio Raymond to scraped Raymund by name", () => {
    const { rows } = compareRegisterToScrapedSummary({
      gpLines: [
        {
          directory_employee_id: "dir-cadacio",
          employee_code: null,
          last_name: "Cadacio",
          first_name: "Raymond",
          gross_pay: 9000,
          net_pay: 8000,
          deductions: {},
        },
      ],
      scraped: [{ name: "CADACIO, RAYMUND L.", gross: 9000, net: 8000 }],
    });
    assert.equal(rows[0].status, "match");
  });

  it("flags scraped_only when GREENHRISMAIN has a person GP does not", () => {
    const { summary } = compareRegisterToScrapedSummary({
      gpLines: [],
      scraped: [{ name: "OMBAO, RENNIEL GUDA", gross: 5000, net: 4000 }],
    });
    assert.equal(summary.scraped_only, 1);
    assert.equal(summary.gp_only, 0);
  });
});
