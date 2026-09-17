import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cutoffRegisterTitle,
  formatCutoffPeriodKindLabel,
  isAdjustmentCutoff,
  parseCutoffPeriodKind,
} from "../cutoff-period-kind";

describe("cutoff-period-kind", () => {
  it("defaults unknown kind to regular", () => {
    assert.equal(parseCutoffPeriodKind(null), "regular");
    assert.equal(parseCutoffPeriodKind("other"), "regular");
    assert.equal(parseCutoffPeriodKind("adjustment"), "adjustment");
  });

  it("labels adjustment cutoffs for register titles", () => {
    assert.equal(cutoffRegisterTitle({ period_kind: "adjustment" }), "Payroll Adjustment");
    assert.equal(cutoffRegisterTitle({ period_kind: "regular" }), "Payroll Summary");
    assert.equal(isAdjustmentCutoff({ period_kind: "adjustment" }), true);
    assert.equal(formatCutoffPeriodKindLabel("adjustment"), "Adjustment");
  });
});
