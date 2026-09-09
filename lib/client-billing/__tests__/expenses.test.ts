import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeBillingFeesWithExpenses,
  normalizeBillingExpenses,
} from "../expenses";

describe("normalizeBillingExpenses", () => {
  it("returns empty for zero / null", () => {
    assert.deepEqual(normalizeBillingExpenses(null), []);
    assert.deepEqual(normalizeBillingExpenses([]), []);
  });

  it("keeps one and many valid rows", () => {
    assert.deepEqual(
      normalizeBillingExpenses([{ particular: "Uniform", amount: 1000 }]),
      [{ particular: "Uniform", amount: 1000 }]
    );
    assert.deepEqual(
      normalizeBillingExpenses([
        { particular: "Uniform", amount: 1000 },
        { particular: "Food Service", amount: 3500.5 },
      ]),
      [
        { particular: "Uniform", amount: 1000 },
        { particular: "Food Service", amount: 3500.5 },
      ]
    );
  });

  it("drops blank particulars and non-finite amounts", () => {
    assert.deepEqual(
      normalizeBillingExpenses([
        { particular: "  ", amount: 10 },
        { particular: "Uniform", amount: "x" },
        { particular: "Nameplate", amount: 250.5 },
      ]),
      [{ particular: "Nameplate", amount: 250.5 }]
    );
  });

  it("caps at max rows", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      particular: `Row ${i}`,
      amount: i,
    }));
    assert.equal(normalizeBillingExpenses(rows, { max: 2 }).length, 2);
  });
});

describe("mergeBillingFeesWithExpenses", () => {
  it("preserves fee rates and replaces expenses", () => {
    const next = mergeBillingFeesWithExpenses(
      { admin_fee: 0.055, vat: 0.12, ewt: 0.1, expenses: [{ particular: "Old", amount: 1 }] },
      [{ particular: "Uniform", amount: 1000 }]
    );
    assert.equal(next.admin_fee, 0.055);
    assert.equal(next.vat, 0.12);
    assert.equal(next.ewt, 0.1);
    assert.deepEqual(next.expenses, [{ particular: "Uniform", amount: 1000 }]);
  });

  it("clears expenses when given an empty list", () => {
    const next = mergeBillingFeesWithExpenses(
      { admin_fee: 0.055, expenses: [{ particular: "Old", amount: 1 }] },
      []
    );
    assert.deepEqual(next.expenses, []);
    assert.equal(next.admin_fee, 0.055);
  });
});
