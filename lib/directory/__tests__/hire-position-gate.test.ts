import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planHirePositionGate } from "../hire-position-gate";

describe("planHirePositionGate", () => {
  it("defers position on identity-step hire (client, no position_id)", () => {
    const r = planHirePositionGate({
      clientId: "b3069907-88a7-4c70-8d31-37d9d0bfd5a4",
      positionId: null,
    });
    assert.deepEqual(r, { ok: true, mode: "defer" });
  });

  it("defers when position_id is blank", () => {
    const r = planHirePositionGate({
      clientId: "c1",
      positionId: "   ",
    });
    assert.deepEqual(r, { ok: true, mode: "defer" });
  });

  it("assigns when client and position_id are both present", () => {
    const r = planHirePositionGate({
      clientId: "c1",
      positionId: "p1",
    });
    assert.deepEqual(r, { ok: true, mode: "assign", positionId: "p1" });
  });

  it("rejects position_id without client_id", () => {
    const r = planHirePositionGate({
      clientId: null,
      positionId: "p1",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error, "position_id requires client_id");
    assert.equal(r.status, 400);
  });

  it("allows organic hire with no client and no position", () => {
    const r = planHirePositionGate({
      clientId: null,
      positionId: null,
    });
    assert.deepEqual(r, { ok: true, mode: "defer" });
  });
});
