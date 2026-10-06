import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planTenureReattachAfterCollapse } from "../tenure-reattach";

describe("planTenureReattachAfterCollapse", () => {
  it("keeps a barred episode closed and seeds live for_release instead of rewriting it", () => {
    const plan = planTenureReattachAfterCollapse({
      masterId: "uuid-202405",
      loserIds: ["uuid-202103"],
      liveStatus: "for_release",
      tenures: [
        {
          id: "tenure-barred",
          employee_id: "uuid-202103",
          sequence: 1,
          is_current: true,
          status: "barred",
        },
      ],
    });
    assert.deepEqual(plan.moveIds, ["tenure-barred"]);
    assert.deepEqual(plan.keepHistoricalIds, ["tenure-barred"]);
    assert.equal(plan.currentId, null);
  });

  it("moves a matching for_release tenure onto the live master", () => {
    const plan = planTenureReattachAfterCollapse({
      masterId: "uuid-202405",
      loserIds: ["uuid-202103"],
      liveStatus: "for_release",
      tenures: [
        {
          id: "tenure-1",
          employee_id: "uuid-202103",
          sequence: 1,
          is_current: true,
          status: "for_release",
        },
      ],
    });
    assert.deepEqual(plan.moveIds, ["tenure-1"]);
    assert.deepEqual(plan.keepHistoricalIds, []);
    assert.equal(plan.currentId, "tenure-1");
  });

  it("seeds when neither master nor parked files have a tenure row", () => {
    const plan = planTenureReattachAfterCollapse({
      masterId: "master",
      loserIds: ["loser"],
      liveStatus: "active",
      tenures: [],
    });
    assert.deepEqual(plan.moveIds, []);
    assert.equal(plan.currentId, null);
  });

  it("keeps the master's current tenure when both files already have rows", () => {
    const plan = planTenureReattachAfterCollapse({
      masterId: "master",
      loserIds: ["loser"],
      liveStatus: "active",
      tenures: [
        {
          id: "on-master",
          employee_id: "master",
          sequence: 2,
          is_current: true,
          status: "active",
        },
        {
          id: "on-loser",
          employee_id: "loser",
          sequence: 1,
          is_current: true,
          status: "inactive",
        },
      ],
    });
    assert.deepEqual(plan.moveIds, ["on-loser"]);
    assert.equal(plan.currentId, "on-master");
    assert.deepEqual(plan.keepHistoricalIds, ["on-loser"]);
    assert.ok(plan.clearCurrentIds.includes("on-master"));
    assert.ok(plan.clearCurrentIds.includes("on-loser"));
  });
});
