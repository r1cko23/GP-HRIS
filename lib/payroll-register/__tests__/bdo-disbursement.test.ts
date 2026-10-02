import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeDisbursement,
  attachDebitMemoQueue,
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

describe("cutoff list debit memo queue action", () => {
  const manila = { id: "manila", status: "posted" };
  const draft = { id: "draft-cut", status: "draft" };
  const approved = { id: "approved-cut", status: "approved" };

  it("offers add on a posted cutoff that is not on the queue", () => {
    const [row] = attachDebitMemoQueue(
      [manila],
      [{ id: "run-manila", cutoff_period_id: "manila", status: "posted" }],
      []
    );
    assert.equal(row.posted_run_id, "run-manila");
    assert.equal(row.debit_memo_queue, null);
  });

  it("hides add when the posted cutoff is already queued, awaiting a ref, or locked", () => {
    const rows = attachDebitMemoQueue(
      [
        { id: "queued", status: "posted" },
        { id: "awaiting", status: "posted" },
        { id: "locked", status: "posted" },
      ],
      [
        { id: "run-q", cutoff_period_id: "queued", status: "posted" },
        { id: "run-a", cutoff_period_id: "awaiting", status: "posted" },
        { id: "run-l", cutoff_period_id: "locked", status: "posted" },
      ],
      [
        { payroll_register_run_id: "run-q", status: "queued" },
        { payroll_register_run_id: "run-a", status: "awaiting_ref" },
        { payroll_register_run_id: "run-l", status: "confirmed" },
      ]
    );
    assert.deepEqual(
      rows.map((row) => row.debit_memo_queue),
      ["queued", "awaiting_ref", "confirmed"]
    );
    assert.deepEqual(
      rows.map((row) => row.posted_run_id),
      ["run-q", "run-a", "run-l"]
    );
  });

  it("offers add again after the only disbursement was voided", () => {
    const [row] = attachDebitMemoQueue(
      [manila],
      [{ id: "run-manila", cutoff_period_id: "manila", status: "posted" }],
      [{ payroll_register_run_id: "run-manila", status: "void" }]
    );
    assert.equal(row.posted_run_id, "run-manila");
    assert.equal(row.debit_memo_queue, null);
  });

  it("does not offer add on draft or approved cutoffs, or a posted cutoff with no posted run", () => {
    const rows = attachDebitMemoQueue(
      [draft, approved, { id: "posted-no-run", status: "posted" }, manila],
      [
        { id: "run-draft", cutoff_period_id: "draft-cut", status: "draft" },
        { id: "run-unposted", cutoff_period_id: "manila", status: "draft" },
      ],
      []
    );
    assert.deepEqual(
      rows.map((row) => row.posted_run_id),
      [null, null, null, null]
    );
    assert.deepEqual(
      rows.map((row) => row.debit_memo_queue),
      [null, null, null, null]
    );
  });

  it("keeps queue state on the matching cutoff when the list has many rows", () => {
    const rows = attachDebitMemoQueue(
      [draft, manila, approved],
      [{ id: "run-manila", cutoff_period_id: "manila", status: "posted" }],
      []
    );
    assert.equal(rows[0]?.posted_run_id, null);
    assert.equal(rows[1]?.posted_run_id, "run-manila");
    assert.equal(rows[1]?.debit_memo_queue, null);
    assert.equal(rows[2]?.posted_run_id, null);
  });

  it("returns an empty list unchanged", () => {
    assert.deepEqual(attachDebitMemoQueue([], [], []), []);
  });
});
