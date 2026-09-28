import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeRefundAmount } from "../cutoff-refund";
import { buildRegisterLine } from "@/lib/payroll-register/compute";
import type { CutoffHoursRow } from "@/lib/ph-payroll/premiums";
import {
  refundAmountForPerson,
  type RefundAmountsByPerson,
} from "@/lib/payroll-register/load-refund-amounts";

describe("normalizeRefundAmount", () => {
  it("rounds to two decimal places", () => {
    assert.equal(normalizeRefundAmount(10.006), 10.01);
    assert.equal(normalizeRefundAmount("250.5"), 250.5);
  });

  it("treats missing / non-numeric as zero", () => {
    assert.equal(normalizeRefundAmount(undefined), 0);
    assert.equal(normalizeRefundAmount(null), 0);
    assert.equal(normalizeRefundAmount(""), 0);
  });
});

const hoursRow: CutoffHoursRow = {
  id: "h1",
  directory_employee_id: "d1",
  office_employee_id: "o1",
  employee_code: "E1",
  last_name: "Cruz",
  first_name: "Ben",
  daily_rate_payroll: 800,
  actual_regular_hours: 80,
  allowance: 0,
};

describe("cutoff refund on register build", () => {
  it("feeds positive refund into earnings.adjustment (audit refund column)", () => {
    const without = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    const withRefund = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      adjustmentAmount: normalizeRefundAmount(250.5),
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    assert.equal(withRefund.earnings.adjustment, 250.5);
    assert.equal(withRefund.gross_pay, round2(without.gross_pay + 250.5));
  });

  it("resolves refund by directory id then office id", () => {
    const maps: RefundAmountsByPerson = {
      byDirectoryId: new Map([["d1", 100]]),
      byOfficeId: new Map([["o1", 50]]),
    };
    assert.equal(refundAmountForPerson(maps, "d1", "o1"), 100);
    assert.equal(refundAmountForPerson(maps, null, "o1"), 50);
    assert.equal(refundAmountForPerson(maps, "missing", "missing"), 0);
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
