import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planRateFromPositionCard } from "../position-card-rate";

describe("planRateFromPositionCard", () => {
  it("lifts person daily_rate up to the position card (does not copy billing)", () => {
    const plan = planRateFromPositionCard({
      employeeId: "aban",
      employee_code: "202309-00023",
      daily_rate: 540,
      position_payroll_daily_rate: 600,
    });
    assert.equal(plan.action, "lift");
    if (plan.action !== "lift") return;
    assert.equal(plan.daily_rate, 600);
    assert.equal(plan.keep_employee_code, "202309-00023");
    assert.equal("billing_daily_rate" in plan, false);
  });

  it("is a no-op when the person already matches the card", () => {
    const plan = planRateFromPositionCard({
      employeeId: "aban",
      employee_code: "202309-00023",
      daily_rate: 600,
      position_payroll_daily_rate: 600,
    });
    assert.deepEqual(plan, { action: "noop" });
  });

  it("skips when there is no position card rate (does not invent from scrape)", () => {
    const plan = planRateFromPositionCard({
      employeeId: "dayto",
      employee_code: "202209-00148",
      daily_rate: 677.25,
      position_payroll_daily_rate: null,
    });
    assert.deepEqual(plan, { action: "skip", reason: "no_position_rate" });
  });
});
