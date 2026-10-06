import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPositionCardRates,
  assertAssignableApprovedPosition,
  personStandingRatesFromCard,
} from "../apply-position-card-rates";

describe("applyPositionCardRates", () => {
  it("reads payroll, billing, ECOLA, SEA, and CTPA from the card", () => {
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

  it("still rejects a card with no payroll daily rate", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: 0,
      billing_daily_rate: 0,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(
      r.error,
      "Approved position must have payroll and billing daily rates"
    );
  });

  it("assigns an approved card whose billing daily rate is zero", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: "600.0000",
      billing_daily_rate: "0.0000",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rates.daily_rate, 600);
    assert.equal(r.rates.billing_daily_rate, null);
  });
});

describe("personStandingRatesFromCard", () => {
  it("stamps only MAIN person-standing rates (daily, billing, ECOLA) — not SEA/CTPA", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: 600,
      billing_daily_rate: 750,
      ecola: 10,
      sea: 20,
      ctpa: 5,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const person = personStandingRatesFromCard(r.rates);
    assert.deepEqual(person, {
      daily_rate: 600,
      billing_daily_rate: 750,
      ecola: 10,
    });
    assert.equal("sea" in person, false);
    assert.equal("ctpa" in person, false);
  });

  it("keeps a null billing daily rate when the card billing is zero", () => {
    const r = applyPositionCardRates({
      payroll_daily_rate: 600,
      billing_daily_rate: 0,
      ecola: null,
      sea: 15,
      ctpa: 3,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const person = personStandingRatesFromCard(r.rates);
    assert.deepEqual(person, {
      daily_rate: 600,
      billing_daily_rate: null,
      ecola: null,
    });
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

  it("accepts an approved card with a zero billing daily rate", () => {
    const r = assertAssignableApprovedPosition({
      position: { ...approved, billing_daily_rate: 0 },
      destinationClientId: "c1",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.rates.daily_rate, 500);
    assert.equal(r.rates.billing_daily_rate, null);
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
