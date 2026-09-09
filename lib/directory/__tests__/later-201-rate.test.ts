import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planMasterRateFromLater201 } from "../later-201-rate";

const master = {
  id: "orig",
  employee_code: "202211-00036",
  daily_rate: 540,
  position_id: "motorist-540",
  billing_daily_rate: 0,
};

const later = {
  id: "dup",
  employee_code: "202506-00194",
  daily_rate: 695,
  position_id: "jr-extruck-695",
  billing_daily_rate: 0,
};

describe("planMasterRateFromLater201", () => {
  it("copies daily_rate and position from the later 201 onto the CSM original", () => {
    const plan = planMasterRateFromLater201({ master, later });
    assert.equal(plan.action, "lift");
    if (plan.action !== "lift") return;
    assert.equal(plan.employeeId, "orig");
    assert.equal(plan.daily_rate, 695);
    assert.equal(plan.position_id, "jr-extruck-695");
    assert.equal(plan.keep_employee_code, "202211-00036");
    assert.equal("billing_daily_rate" in plan, false);
  });

  it("is a no-op when the original already has that rate and position", () => {
    const plan = planMasterRateFromLater201({
      master: { ...master, daily_rate: 695, position_id: "jr-extruck-695" },
      later,
    });
    assert.deepEqual(plan, { action: "noop" });
  });

  it("skips when the later 201 has no daily rate", () => {
    const plan = planMasterRateFromLater201({
      master,
      later: { ...later, daily_rate: 0 },
    });
    assert.deepEqual(plan, { action: "skip", reason: "later_has_no_rate" });
  });
});
