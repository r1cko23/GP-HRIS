import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareRegisterToLegacy } from "../payroll-summary-parity";

describe("compareRegisterToLegacy", () => {
  const legacyIdByDirectoryId = new Map([["dir-1", 1001]]);

  it("marks exact gross+net as match", () => {
    const { rows, summary } = compareRegisterToLegacy({
      gpLines: [
        {
          directory_employee_id: "dir-1",
          employee_code: "202401-00001",
          last_name: "Alberto",
          first_name: "Jonathan",
          gross_pay: 10000,
          net_pay: 8500,
          deductions: {
            sss: 0,
            philhealth: 0,
            pagibig: 0,
            withholding_tax: 500,
            loans: 1000,
          },
        },
      ],
      legacyRows: [
        {
          employee_id: 1001,
          last_name: "Alberto",
          first_name: "Jonathan",
          period_start: "2026-09-01",
          period_end: "2026-09-15",
          gross: 10000,
          sss_ee: 0,
          philhealth_ee: 0,
          pagibig_ee: 0,
          wtax: 500,
          salary_loan: 1000,
          pagibig_loan: 0,
          net: 8500,
        },
      ],
      legacyIdByDirectoryId,
    });
    assert.equal(rows[0].status, "match");
    assert.equal(summary.match, 1);
    assert.equal(summary.mismatch, 0);
  });

  it("flags legacy_only rows", () => {
    const { rows, summary } = compareRegisterToLegacy({
      gpLines: [],
      legacyRows: [
        {
          employee_id: 2002,
          last_name: "Solo",
          first_name: "Legacy",
          period_start: "2026-09-01",
          period_end: "2026-09-15",
          gross: 5000,
          sss_ee: 0,
          philhealth_ee: 0,
          pagibig_ee: 0,
          wtax: 0,
          salary_loan: 0,
          pagibig_loan: 0,
          net: 5000,
        },
      ],
      legacyIdByDirectoryId,
    });
    assert.equal(rows[0].status, "legacy_only");
    assert.equal(summary.legacy_only, 1);
  });

  it("flags gp_no_legacy_link when directory has no legacy_id", () => {
    const { rows } = compareRegisterToLegacy({
      gpLines: [
        {
          directory_employee_id: "dir-new",
          employee_code: "202609-00002",
          last_name: "New",
          first_name: "Hire",
          gross_pay: 1000,
          net_pay: 1000,
          deductions: {},
        },
      ],
      legacyRows: [],
      legacyIdByDirectoryId: new Map(),
    });
    assert.equal(rows[0].status, "gp_no_legacy_link");
  });
});
