import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPositionCardRates,
  assertAssignableApprovedPosition,
} from "../apply-position-card-rates";

describe("applyPositionCardRates", () => {
  it("copies payroll, billing, and optional allowances onto the person", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: 600,
      billing_daily_rate: 750,
      ecola: 10,
      sea: null,
      ctpa: 5,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rates.daily_rate, 600);
    assert.equal(r.rates.billing_daily_rate, 750);
    assert.equal(r.rates.ecola, 10);
    assert.equal(r.rates.sea, null);
    assert.equal(r.rates.ctpa, 5);
  });

  it("fails when card rates are incomplete", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: 600,
      billing_daily_rate: null,
    });
    assert.equal(r.ok, false);
  });
});

describe("assertAssignableApprovedPosition", () => {
  const approved = {
    id: "p1",
    client_id: "c1",
    is_active: true,
    approval_status: "approved",
    payroll_daily_rate: 500,
    billing_daily_rate: 550,
  };

  it("accepts approved active card on destination client", () => {
    const r = assertAssignableApprovedPosition({
      position: approved,
      destinationClientId: "c1",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rates.daily_rate, 500);
  });

  it("rejects missing, wrong client, inactive, or unapproved", () => {
    assert.equal(
      assertAssignableApprovedPosition({
        position: null,
        destinationClientId: "c1",
      }).ok,
      false
    );
    assert.equal(
      assertAssignableApprovedPosition({
        position: { ...approved, client_id: "other" },
        destinationClientId: "c1",
      }).ok,
      false
    );
    assert.equal(
      assertAssignableApprovedPosition({
        position: { ...approved, is_active: false },
        destinationClientId: "c1",
      }).ok,
      false
    );
    assert.equal(
      assertAssignableApprovedPosition({
        position: { ...approved, approval_status: "pending" },
        destinationClientId: "c1",
      }).ok,
      false
    );
  });
});
