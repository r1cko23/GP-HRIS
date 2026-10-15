import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRegisterDailyRate } from "../compute";

describe("resolveRegisterDailyRate", () => {
  it("keeps cutoff hours rate when payable ledger is stale lower", () => {
    assert.equal(
      resolveRegisterDailyRate({
        hoursDailyRate: 695,
        directoryDailyRate: 695,
        payableDailyRate: 645,
      }),
      695
    );
  });

  it("falls back to Directory when hours rate is missing", () => {
    assert.equal(
      resolveRegisterDailyRate({
        hoursDailyRate: 0,
        directoryDailyRate: 695,
        payableDailyRate: 645,
      }),
      695
    );
  });

  it("uses payable only when hours and Directory have no rate", () => {
    assert.equal(
      resolveRegisterDailyRate({
        hoursDailyRate: null,
        directoryDailyRate: null,
        payableDailyRate: 645,
      }),
      645
    );
  });

  it("keeps hours freeze when Directory rate was updated after the cutoff", () => {
    assert.equal(
      resolveRegisterDailyRate({
        hoursDailyRate: 645,
        directoryDailyRate: 700,
        payableDailyRate: 700,
      }),
      645
    );
  });
});
