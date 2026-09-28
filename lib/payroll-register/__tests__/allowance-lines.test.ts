import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWANCE_KEYS,
  ALLOWANCE_LABELS,
  allowanceKeysForScope,
  allowanceScopeFromOrgName,
  buildAllowanceLines,
  sumAllowanceLines,
} from "../allowance-lines";

describe("standing allowances", () => {
  it("catalogs Deployed TL and Organic Load + Supervisory", () => {
    assert.deepEqual([...ALLOWANCE_KEYS], [
      "tl_allowance",
      "load_allowance",
      "supervisory_allowance",
    ]);
    assert.equal(ALLOWANCE_LABELS.tl_allowance, "TL allowance");
    assert.equal(ALLOWANCE_LABELS.load_allowance, "Load allowance");
    assert.equal(
      ALLOWANCE_LABELS.supervisory_allowance,
      "Supervisory allowance"
    );
  });

  it("scopes Organic to Load + Supervisory and Deployed to TL only", () => {
    assert.deepEqual([...allowanceKeysForScope("organic")], [
      "load_allowance",
      "supervisory_allowance",
    ]);
    assert.deepEqual([...allowanceKeysForScope("deployed")], ["tl_allowance"]);
    assert.equal(allowanceScopeFromOrgName("Organic"), "organic");
    assert.equal(allowanceScopeFromOrgName("Deployed"), "deployed");
  });

  it("builds positive lines and sums for register earnings.allowance", () => {
    const lines = buildAllowanceLines({
      tl_allowance: 500,
      load_allowance: 0,
      supervisory_allowance: 150.555,
      ignored: 99,
    });
    assert.deepEqual(lines, [
      { key: "tl_allowance", particular: "TL allowance", amount: 500 },
      {
        key: "supervisory_allowance",
        particular: "Supervisory allowance",
        amount: 150.56,
      },
    ]);
    assert.equal(sumAllowanceLines(lines), 650.56);
  });

  it("returns empty when all amounts are zero", () => {
    assert.deepEqual(buildAllowanceLines({ tl_allowance: 0 }), []);
    assert.equal(sumAllowanceLines([]), 0);
  });
});

import { buildRegisterLine } from "../compute";
import type { CutoffHoursRow } from "@/lib/ph-payroll/premiums";

const hoursRow: CutoffHoursRow = {
  id: "h1",
  directory_employee_id: "d1",
  office_employee_id: "o1",
  employee_code: "E1",
  last_name: "Cruz",
  first_name: "Ben",
  daily_rate_payroll: 800,
  actual_regular_hours: 80,
  allowance: 100,
};

describe("buildRegisterLine standing allowances", () => {
  it("adds standing TL/Load/Supervisory onto earnings.allowance and gross", () => {
    const lines = buildAllowanceLines({
      tl_allowance: 500,
      load_allowance: 200,
      supervisory_allowance: 150,
    });
    const without = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    const withStanding = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      allowanceLines: lines,
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    assert.equal(withStanding.earnings.allowance, round2(without.earnings.allowance + 850));
    assert.equal(withStanding.gross_pay, round2(without.gross_pay + 850));
    assert.equal(withStanding.allowance_lines.length, 3);
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
