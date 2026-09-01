import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickNextOpenCutoff,
  sumCatchupByDirectoryEmployee,
  validateCatchupAmount,
  validateCatchupReason,
} from "../catchup-corrections";
import { buildRegisterLine } from "../compute";

describe("pickNextOpenCutoff", () => {
  it("picks earliest open cutoff after source end", () => {
    const next = pickNextOpenCutoff(
      { period_end: "2026-07-31", client_id: "c1" },
      [
        {
          id: "a",
          client_id: "c1",
          status: "draft",
          period_start: "2026-08-16",
          period_end: "2026-08-31",
        },
        {
          id: "b",
          client_id: "c1",
          status: "draft",
          period_start: "2026-08-01",
          period_end: "2026-08-15",
        },
        {
          id: "c",
          client_id: "c1",
          status: "posted",
          period_start: "2026-08-01",
          period_end: "2026-08-15",
        },
      ]
    );
    assert.equal(next?.id, "b");
  });

  it("returns null when no open successor exists", () => {
    const next = pickNextOpenCutoff(
      { period_end: "2026-07-31", client_id: "c1" },
      [
        {
          id: "a",
          client_id: "c1",
          status: "posted",
          period_start: "2026-08-01",
          period_end: "2026-08-15",
        },
      ]
    );
    assert.equal(next, null);
  });
});

describe("sumCatchupByDirectoryEmployee", () => {
  it("sums pending amounts only", () => {
    const map = sumCatchupByDirectoryEmployee([
      {
        directory_employee_id: "e1",
        amount: 100,
        status: "pending",
      },
      {
        directory_employee_id: "e1",
        amount: -25,
        status: "pending",
      },
      {
        directory_employee_id: "e1",
        amount: 50,
        status: "cancelled",
      },
      {
        directory_employee_id: "e2",
        amount: 10,
        status: "pending",
      },
    ]);
    assert.equal(map.get("e1"), 75);
    assert.equal(map.get("e2"), 10);
  });
});

describe("validateCatchupAmount / reason", () => {
  it("rejects zero and blank reason", () => {
    assert.equal(validateCatchupAmount(0), null);
    assert.equal(validateCatchupReason("ab"), null);
    assert.equal(validateCatchupAmount(12.345), 12.35);
    assert.equal(validateCatchupReason("  missed OT  "), "missed OT");
  });
});

describe("buildRegisterLine catch-up", () => {
  it("folds adjustment into earnings and gross without changing statutory", () => {
    const hoursRow = {
      id: "h1",
      directory_employee_id: "d1",
      office_employee_id: "o1",
      employee_code: "202607-00001",
      last_name: "Reyes",
      first_name: "Ana",
      daily_rate_payroll: 500,
      actual_regular_hours: 80,
      overtime_hours: 0,
      night_diff_hours: 0,
      legal_holiday_hours: 0,
      special_holiday_hours: 0,
      rest_day_hours: 0,
      wdo_hours: 0,
      pto_hours: 0,
      tardiness_hours: 0,
      undertime_hours: 0,
      absences_hours: 0,
      allowance: 0,
    };
    const base = buildRegisterLine({
      hoursRow,
      loans: [],
      periodStart: new Date("2026-08-01"),
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    const withAdj = buildRegisterLine({
      hoursRow,
      loans: [],
      periodStart: new Date("2026-08-01"),
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
      adjustmentAmount: 250,
    });
    assert.equal(withAdj.earnings.adjustment, 250);
    assert.equal(withAdj.gross_pay, Math.round((base.gross_pay + 250) * 100) / 100);
    assert.equal(withAdj.net_pay, Math.round((base.net_pay + 250) * 100) / 100);
  });
});
