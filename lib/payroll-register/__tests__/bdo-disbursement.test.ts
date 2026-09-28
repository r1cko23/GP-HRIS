import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeDisbursement,
  canEnqueueRun,
  canGenerateForRun,
  canPasteBdoReference,
  canVoidDisbursement,
  queueStatusForRun,
  type BdoDisbursementSnap,
} from "../bdo-disbursement";

const runId = "run-1";

function snap(
  partial: Partial<BdoDisbursementSnap> & Pick<BdoDisbursementSnap, "id" | "status">
): BdoDisbursementSnap {
  return {
    payroll_register_run_id: runId,
    ...partial,
  };
}

describe("Debit Memo Queue manual enqueue", () => {
  it("does not treat posted-only runs as on the queue", () => {
    assert.equal(queueStatusForRun(null), null);
    assert.equal(canEnqueueRun(null).ok, true);
    assert.equal(canGenerateForRun(null).ok, false);
  });

  it("blocks second enqueue while queued / awaiting / confirmed", () => {
    assert.equal(
      canEnqueueRun(snap({ id: "a", status: "queued" })).ok,
      false
    );
    assert.equal(
      canEnqueueRun(snap({ id: "a", status: "awaiting_ref" })).ok,
      false
    );
    assert.equal(
      canEnqueueRun(
        snap({ id: "a", status: "confirmed", bdo_reference: "X" })
      ).ok,
      false
    );
  });

  it("allows generate only while queued", () => {
    assert.equal(
      canGenerateForRun(snap({ id: "a", status: "queued" })).ok,
      true
    );
    assert.equal(
      canGenerateForRun(snap({ id: "a", status: "awaiting_ref" })).ok,
      false
    );
  });

  it("allows paste only on awaiting_ref with a unique reference", () => {
    const awaiting = snap({ id: "a", status: "awaiting_ref" });
    const taken = new Set(["ALREADY"]);
    assert.equal(canPasteBdoReference(awaiting, "NEW", taken).ok, true);
    assert.equal(
      canPasteBdoReference(snap({ id: "a", status: "queued" }), "NEW", taken)
        .ok,
      false
    );
  });

  it("allows void while queued or awaiting_ref; confirmed is immutable", () => {
    assert.equal(
      canVoidDisbursement(snap({ id: "a", status: "queued" })).ok,
      true
    );
    assert.equal(
      canVoidDisbursement(snap({ id: "a", status: "awaiting_ref" })).ok,
      true
    );
    assert.equal(
      canVoidDisbursement(
        snap({ id: "a", status: "confirmed", bdo_reference: "X" })
      ).ok,
      false
    );
  });

  it("void reopens enqueue", () => {
    const rows = [
      snap({ id: "a", status: "void" }),
      snap({ id: "b", status: "queued" }),
    ];
    assert.equal(activeDisbursement(rows)?.id, "b");
    assert.equal(queueStatusForRun(activeDisbursement([snap({ id: "a", status: "void" })])), null);
    assert.equal(canEnqueueRun(activeDisbursement([snap({ id: "a", status: "void" })])).ok, true);
  });
});
