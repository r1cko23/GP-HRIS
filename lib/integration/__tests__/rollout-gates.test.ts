import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRolloutExitGates } from "../rollout-gates";

test("requires identity, work lineage, zero orphans and two signed-off cutoffs", () => {
  const passing = evaluateRolloutExitGates({
    identityCoveragePercent: 100,
    placementCoveragePercent: 100,
    workLineageCoveragePercent: 100,
    orphanCount: 0,
    unexplainedVarianceCount: 0,
    signedOffCutoffs: 2,
  });
  assert.equal(passing.canRetireLegacyPaths, true);
  assert.deepEqual(passing.blockers, []);

  const blocked = evaluateRolloutExitGates({
    identityCoveragePercent: 99,
    placementCoveragePercent: 100,
    workLineageCoveragePercent: 100,
    orphanCount: 1,
    unexplainedVarianceCount: 0,
    signedOffCutoffs: 1,
  });
  assert.equal(blocked.canRetireLegacyPaths, false);
  assert.deepEqual(blocked.blockers, [
    "identity_coverage",
    "orphan_records",
    "signed_off_cutoffs",
  ]);
});
