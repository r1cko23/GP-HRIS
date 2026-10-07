export type RolloutMetrics = {
  identityCoveragePercent: number;
  placementCoveragePercent: number;
  workLineageCoveragePercent: number;
  orphanCount: number;
  unexplainedVarianceCount: number;
  signedOffCutoffs: number;
};

export function evaluateRolloutExitGates(metrics: RolloutMetrics) {
  const blockers: string[] = [];
  if (metrics.identityCoveragePercent < 100) blockers.push("identity_coverage");
  if (metrics.placementCoveragePercent < 100) {
    blockers.push("placement_coverage");
  }
  if (metrics.workLineageCoveragePercent < 100) {
    blockers.push("work_lineage_coverage");
  }
  if (metrics.orphanCount > 0) blockers.push("orphan_records");
  if (metrics.unexplainedVarianceCount > 0) {
    blockers.push("unexplained_variances");
  }
  if (metrics.signedOffCutoffs < 2) blockers.push("signed_off_cutoffs");
  return { canRetireLegacyPaths: blockers.length === 0, blockers };
}
