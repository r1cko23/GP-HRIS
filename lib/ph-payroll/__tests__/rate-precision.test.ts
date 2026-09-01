import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dailyFromMonthlyRate,
  formatDailyRateInput,
  monthlyFromDailyRate,
  restoreDailyRatePrecision,
  roundDailyRate4,
} from "../rate-precision";
import { calculateMonthlySalary } from "../contributions";
import { previewStatutoryFromDailyRate } from "../statutory-preview";

describe("rate precision (daily vs monthly × 26)", () => {
  it("derives 92000 monthly from 92000/26 at 4dp", () => {
    const daily = dailyFromMonthlyRate(92000);
    assert.equal(daily, 3538.4615);
    assert.equal(monthlyFromDailyRate(daily), 92000);
    assert.equal(calculateMonthlySalary(daily, 26), 92000);
  });

  it("restores 2dp-truncated daily that drifts under a whole-peso monthly", () => {
    const restored = restoreDailyRatePrecision(3538.46);
    assert.equal(restored, 3538.4615);
    assert.equal(monthlyFromDailyRate(restored!), 92000);
  });

  it("leaves exact 2dp rates alone when monthly is already whole pesos", () => {
    assert.equal(restoreDailyRatePrecision(800), 800);
    assert.equal(monthlyFromDailyRate(800), 20800);
  });

  it("formats edit input with up to 4dp and trims zeros", () => {
    assert.equal(formatDailyRateInput(3538.4615), "3538.4615");
    assert.equal(formatDailyRateInput(800), "800");
    assert.equal(formatDailyRateInput(800.5), "800.5");
  });

  it("statutory preview monthly uses full-precision daily, UI-style 2dp daily display still formats", () => {
    const preview = previewStatutoryFromDailyRate(3538.4615);
    assert.ok(preview);
    assert.equal(preview!.monthlySalary, 92000);
    assert.equal(roundDailyRate4(preview!.dailyRate), 3538.4615);
    // Display path rounds for money labels only
    assert.equal(Math.round(preview!.dailyRate * 100) / 100, 3538.46);
  });

  it("rounded-only daily still previews the wrong monthly (documents why backfill matters)", () => {
    const preview = previewStatutoryFromDailyRate(3538.46);
    assert.ok(preview);
    assert.equal(preview!.monthlySalary, 91999.96);
  });
});
