import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILLING_OUTPUT_PACKS,
  parseBillingOutputPack,
} from "../output-pack";

describe("parseBillingOutputPack", () => {
  it("accepts known packs and defaults to generic", () => {
    assert.equal(parseBillingOutputPack("aldex"), "aldex");
    assert.equal(parseBillingOutputPack("PLK"), "plk");
    assert.equal(parseBillingOutputPack("debit_memo"), "debit_memo");
    assert.equal(parseBillingOutputPack(""), "generic");
    assert.equal(parseBillingOutputPack(null), "generic");
    assert.ok(BILLING_OUTPUT_PACKS.includes("generic"));
  });
});
