import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCutoffRefundUpsert } from "../cutoff-refund";

describe("buildCutoffRefundUpsert", () => {
  it("writes Client–Employee refund amount for a cutoff without wiping other allowances", () => {
    const row = buildCutoffRefundUpsert({
      employeeId: "emp-1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-15",
      refund: 250.5,
      existing: {
        transpo_allowance: 100,
        load_allowance: 50,
        allowance: 75,
      },
    });
    assert.deepEqual(row, {
      employee_id: "emp-1",
      period_start: "2026-09-01",
      period_end: "2026-09-15",
      refund: 250.5,
      transpo_allowance: 100,
      load_allowance: 50,
      allowance: 75,
    });
  });

  it("defaults other allowance columns to zero when no prior row exists", () => {
    const row = buildCutoffRefundUpsert({
      employeeId: "emp-2",
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      refund: 0,
    });
    assert.equal(row.refund, 0);
    assert.equal(row.transpo_allowance, 0);
    assert.equal(row.load_allowance, 0);
    assert.equal(row.allowance, 0);
  });

  it("rounds refund to two decimal places", () => {
    const row = buildCutoffRefundUpsert({
      employeeId: "emp-3",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-15",
      refund: 10.006,
    });
    assert.equal(row.refund, 10.01);
  });
});
