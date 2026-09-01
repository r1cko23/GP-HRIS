import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewStatutoryFromDailyRate } from "../statutory-preview";

describe("previewStatutoryFromDailyRate", () => {
  it("returns null when daily rate is missing", () => {
    assert.equal(previewStatutoryFromDailyRate(null), null);
    assert.equal(previewStatutoryFromDailyRate(0), null);
  });

  it("derives monthly salary at 26 days and per-cutoff statutory", () => {
    const preview = previewStatutoryFromDailyRate(800);
    assert.ok(preview);
    assert.equal(preview!.monthlySalary, 20800);
    assert.equal(preview!.hourlyRate, 100);
    assert.equal(preview!.monthlyEe.pagibig, preview!.perCutoff.pagibig * 2);
    assert.ok(preview!.monthlyEr.pagibig > 0);
    assert.ok(preview!.wtaxIllustrative.withholdingTax >= 0);
  });

  it("keeps whole-peso monthly when daily retains 4dp (92000 ÷ 26)", () => {
    const preview = previewStatutoryFromDailyRate(3538.4615);
    assert.ok(preview);
    assert.equal(preview!.monthlySalary, 92000);
  });
});
