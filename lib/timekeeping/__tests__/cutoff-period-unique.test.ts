import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cutoffBranchDatesUniqueIncludesKind,
  cutoffUnbranchedDatesUniqueIncludesKind,
} from "../cutoff-period-unique";

describe("cutoff period unique indexes include period_kind", () => {
  it("rejects the pre-238 branched index that blocked adjustment inserts", () => {
    const legacy =
      "CREATE UNIQUE INDEX cutoff_periods_org_client_branch_dates_key ON public.cutoff_periods USING btree (organization_id, client_id, branch_id, period_start, period_end) WHERE (branch_id IS NOT NULL)";
    assert.equal(cutoffBranchDatesUniqueIncludesKind(legacy), false);
  });

  it("accepts the branched index that includes period_kind", () => {
    const fixed =
      "CREATE UNIQUE INDEX cutoff_periods_org_client_branch_dates_kind_key ON public.cutoff_periods USING btree (organization_id, client_id, branch_id, period_start, period_end, period_kind) WHERE (branch_id IS NOT NULL)";
    assert.equal(cutoffBranchDatesUniqueIncludesKind(fixed), true);
  });

  it("rejects the pre-238 unbranched index without period_kind", () => {
    const legacy =
      "CREATE UNIQUE INDEX cutoff_periods_org_client_unbranched_dates_key ON public.cutoff_periods USING btree (organization_id, client_id, period_start, period_end) WHERE (branch_id IS NULL)";
    assert.equal(cutoffUnbranchedDatesUniqueIncludesKind(legacy), false);
  });

  it("accepts the unbranched index that includes period_kind", () => {
    const fixed =
      "CREATE UNIQUE INDEX cutoff_periods_org_client_unbranched_dates_kind_key ON public.cutoff_periods USING btree (organization_id, client_id, period_start, period_end, period_kind) WHERE (branch_id IS NULL)";
    assert.equal(cutoffUnbranchedDatesUniqueIncludesKind(fixed), true);
  });
});
