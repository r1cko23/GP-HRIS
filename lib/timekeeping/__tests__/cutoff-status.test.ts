import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeleteCutoffPeriod,
  canTransitionCutoffStatus,
  cutoffDeleteDenial,
} from "../cutoff-status";

describe("canDeleteCutoffPeriod", () => {
  it("lets payroll discard a draft cutoff so the same dates can be opened again", () => {
    assert.equal(canDeleteCutoffPeriod("draft"), true);
  });

  it("lets payroll discard a pending-audit cutoff that has not been approved", () => {
    assert.equal(canDeleteCutoffPeriod("pending_audit"), true);
  });

  it("blocks delete after hours are locked or payroll is posted", () => {
    assert.equal(canDeleteCutoffPeriod("approved"), false);
    assert.equal(canDeleteCutoffPeriod("posted"), false);
    assert.equal(canDeleteCutoffPeriod("cancelled"), false);
  });

  it("names why a locked cutoff cannot be deleted", () => {
    assert.match(cutoffDeleteDenial("approved") ?? "", /approved/i);
    assert.match(cutoffDeleteDenial("posted") ?? "", /posted/i);
    assert.equal(cutoffDeleteDenial("draft"), null);
    assert.equal(cutoffDeleteDenial("pending_audit"), null);
  });
});

describe("canTransitionCutoffStatus", () => {
  it("still allows draft and pending-audit to move to cancelled", () => {
    assert.equal(canTransitionCutoffStatus("draft", "cancelled"), true);
    assert.equal(
      canTransitionCutoffStatus("pending_audit", "cancelled"),
      true
    );
  });

  it("does not allow posted payroll to be cancelled or deleted via status", () => {
    assert.equal(canTransitionCutoffStatus("posted", "cancelled"), false);
    assert.equal(canTransitionCutoffStatus("posted", "draft"), false);
  });
});
