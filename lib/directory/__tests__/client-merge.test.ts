import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planClientNameMerges } from "../client-merge";

describe("planClientNameMerges", () => {
  it("merges inactive onto active when names match", () => {
    const plans = planClientNameMerges([
      {
        id: "active-d",
        organization_id: "org",
        name: "Dionne Food Concept OPC",
        status: "active",
        legacy_id: 154,
      },
      {
        id: "inactive-d",
        organization_id: "org",
        name: "dionne food concept opc",
        status: "inactive",
        legacy_id: 170,
      },
    ]);
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.keepId, "active-d");
    assert.equal(plans[0]?.mergeId, "inactive-d");
  });

  it("skips pairs that are both active or both inactive", () => {
    assert.equal(
      planClientNameMerges([
        {
          id: "a1",
          organization_id: "org",
          name: "Same",
          status: "active",
        },
        {
          id: "a2",
          organization_id: "org",
          name: "Same",
          status: "active",
        },
      ]).length,
      0
    );
    assert.equal(
      planClientNameMerges([
        {
          id: "i1",
          organization_id: "org",
          name: "Same",
          status: "inactive",
        },
        {
          id: "i2",
          organization_id: "org",
          name: "Same",
          status: "inactive",
        },
      ]).length,
      0
    );
  });

  it("does not merge across organizations", () => {
    assert.equal(
      planClientNameMerges([
        {
          id: "a",
          organization_id: "org-a",
          name: "Goldilocks",
          status: "active",
        },
        {
          id: "b",
          organization_id: "org-b",
          name: "Goldilocks",
          status: "inactive",
        },
      ]).length,
      0
    );
  });
});
