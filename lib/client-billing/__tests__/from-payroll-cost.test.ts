import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planBillingRateFromPayrollCost } from "../from-payroll-cost";

describe("planBillingRateFromPayrollCost", () => {
  it("copies payroll daily onto billing when MAIN has no billing card", () => {
    const plan = planBillingRateFromPayrollCost({
      employeeId: "nilo",
      billing_daily_rate: 0,
      daily_rate: 695,
    });
    assert.deepEqual(plan, {
      action: "lift",
      employeeId: "nilo",
      billing_daily_rate: 695,
    });
  });

  it("leaves an existing billing rate alone", () => {
    const plan = planBillingRateFromPayrollCost({
      employeeId: "nilo",
      billing_daily_rate: 800,
      daily_rate: 695,
    });
    assert.deepEqual(plan, { action: "noop" });
  });

  it("skips people with no payroll rate", () => {
    const plan = planBillingRateFromPayrollCost({
      employeeId: "nilo",
      billing_daily_rate: 0,
      daily_rate: 0,
    });
    assert.deepEqual(plan, { action: "skip", reason: "no_payroll_rate" });
  });
});
