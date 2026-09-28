import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireCutoffPeriodId } from "../require-cutoff-period-id";

describe("requireCutoffPeriodId", () => {
  it("returns trimmed id", () => {
    assert.equal(requireCutoffPeriodId("  abc  "), "abc");
  });

  it("rejects missing cutoff", () => {
    assert.throws(() => requireCutoffPeriodId(""), /cutoff_period_id is required/);
    assert.throws(() => requireCutoffPeriodId(null), /cutoff_period_id is required/);
    assert.throws(
      () => requireCutoffPeriodId(undefined),
      /cutoff_period_id is required/
    );
  });
});
