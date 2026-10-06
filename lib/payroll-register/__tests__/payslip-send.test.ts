import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payslipSendBatch, planPayslipSend } from "../payslip-send";

describe("planPayslipSend", () => {
  it("sends one email per person who has an address", () => {
    const plan = planPayslipSend([
      { lineId: "l1", name: "Reyes, Ana", email: "ana@example.com" },
      { lineId: "l2", name: "Cruz, Ben", email: " ben@example.com " },
    ]);
    assert.deepEqual(
      plan.toSend.map((row) => row.email),
      ["ana@example.com", "ben@example.com"],
    );
    assert.equal(plan.skipped.length, 0);
  });

  it("skips a missing or unusable email and keeps the name", () => {
    const plan = planPayslipSend([
      { lineId: "l1", name: "Reyes, Ana", email: null },
      { lineId: "l2", name: "Cruz, Ben", email: "not-an-email" },
      { lineId: "l3", name: "Santos, Cia", email: "cia@example.com" },
    ]);
    assert.deepEqual(
      plan.skipped.map((row) => row.name),
      ["Reyes, Ana", "Cruz, Ben"],
    );
    assert.equal(plan.toSend.length, 1);
  });

  it("does nothing when the register has no lines", () => {
    assert.deepEqual(planPayslipSend([]), { toSend: [], skipped: [] });
  });
});

describe("payslipSendBatch", () => {
  it("does not email someone who was already sent", () => {
    const planned = planPayslipSend([
      { lineId: "l1", name: "Reyes, Ana", email: "ana@example.com" },
      { lineId: "l2", name: "Cruz, Ben", email: "ben@example.com" },
    ]);
    const batch = payslipSendBatch({
      planned,
      alreadySentLineIds: ["l1"],
    });
    assert.deepEqual(
      batch.toSend.map((row) => row.lineId),
      ["l2"],
    );
    assert.equal(batch.alreadySent, 1);
  });
});
