import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planEnsureAdjustmentCutoff } from "../ensure-adjustment-cutoff";

describe("planEnsureAdjustmentCutoff", () => {
  const source = {
    id: "src-1",
    organization_id: "org-1",
    client_id: "client-1",
    period_start: "2026-08-16",
    period_end: "2026-08-31",
    status: "posted",
    period_kind: "regular",
  };

  it("allows opening an adjustment from a posted regular cutoff", () => {
    assert.deepEqual(planEnsureAdjustmentCutoff(source), { ok: true });
  });

  it("rejects when the source is not posted", () => {
    const result = planEnsureAdjustmentCutoff({ ...source, status: "approved" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  it("rejects nesting adjustment on adjustment", () => {
    const result = planEnsureAdjustmentCutoff({
      ...source,
      period_kind: "adjustment",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });
});
