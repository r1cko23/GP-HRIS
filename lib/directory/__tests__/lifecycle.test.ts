import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNCLAIMED_FINAL_PAY_DAYS,
  barredKind,
  computeLifecycleSignals,
  effectiveEngagementStatus,
  isAgedUnclaimedFinalPay,
} from "../lifecycle";

const AS_OF = new Date("2026-09-11T00:00:00Z");

describe("aged unclaimed final pay", () => {
  it("is 365 × 3 days", () => {
    assert.equal(UNCLAIMED_FINAL_PAY_DAYS, 1095);
  });

  it("treats last payout older than 3 years as barred, not for_release", () => {
    assert.equal(isAgedUnclaimedFinalPay("2022-07-25", AS_OF), true);
    assert.equal(
      effectiveEngagementStatus("for_release", "2022-07-25", AS_OF),
      "barred"
    );
    const signals = computeLifecycleSignals({
      status: "for_release",
      last_payroll_end: "2022-07-25",
      as_of: AS_OF,
    });
    assert.equal(signals.lifecycle_flag, "barred");
    assert.equal(signals.lifecycle_label, "Barred");
    const alreadyBarred = computeLifecycleSignals({
      status: "barred",
      last_payroll_end: "2022-07-25",
      as_of: AS_OF,
    });
    assert.match(alreadyBarred.lifecycle_hint, /Rehire/);
  });

  it("keeps recent for_release on the final-pay list", () => {
    assert.equal(isAgedUnclaimedFinalPay("2026-08-15", AS_OF), false);
    assert.equal(
      effectiveEngagementStatus("for_release", "2026-08-15", AS_OF),
      "for_release"
    );
    const signals = computeLifecycleSignals({
      status: "for_release",
      last_payroll_end: "2026-08-15",
      as_of: AS_OF,
    });
    assert.equal(signals.lifecycle_flag, "for_release");
  });

  it("does not invent barred from a for_release with no last payout", () => {
    assert.equal(isAgedUnclaimedFinalPay(null, AS_OF), false);
    assert.equal(effectiveEngagementStatus("for_release", null, AS_OF), "for_release");
  });

  it("splits final-pay barred from deployment barred", () => {
    assert.equal(barredKind("barred", "2022-07-25", AS_OF), "unclaimed_final_pay");
    assert.equal(barredKind("barred", "2026-08-15", AS_OF), "deployment_block");
    assert.equal(barredKind("barred", null, AS_OF), "deployment_block");
    assert.equal(barredKind("inactive", "2022-07-25", AS_OF), null);
  });
});
