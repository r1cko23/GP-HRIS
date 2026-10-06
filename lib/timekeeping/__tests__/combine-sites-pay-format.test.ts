import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planCombinedSites } from "../combine-sites-pay-format";

describe("planCombinedSites", () => {
  it("allows one site on its own register", () => {
    assert.deepEqual(
      planCombinedSites([{ branchId: "manila", payFormat: 13 }]),
      { ok: true },
    );
    assert.deepEqual(
      planCombinedSites([{ branchId: "manila", payFormat: null }]),
      { ok: true },
    );
  });

  it("allows sites that share one pay format", () => {
    assert.deepEqual(
      planCombinedSites([
        { branchId: "baesa", payFormat: 0 },
        { branchId: "taytay", payFormat: 0 },
        { branchId: "laguna", payFormat: 0 },
      ]),
      { ok: true },
    );
  });

  it("refuses sites that use different pay formats", () => {
    const plan = planCombinedSites([
      { branchId: "manila", payFormat: 13 },
      { branchId: "ortigas", payFormat: 10 },
    ]);
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /pay format/i);
  });

  it("refuses a combined register when a site has no pay format", () => {
    const plan = planCombinedSites([
      { branchId: "manila", payFormat: 11 },
      { branchId: "pasay", payFormat: null },
    ]);
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /pay format/i);
  });

  it("does not apply to a cutoff with no sites", () => {
    assert.deepEqual(planCombinedSites([]), { ok: true });
  });
});
