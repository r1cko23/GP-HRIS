import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hirePlacementRatePreview,
  hirePositionOptionLabel,
  nextAssignmentFormRates,
} from "../assignment-rates";

describe("nextAssignmentFormRates", () => {
  it("fills payroll and billing from the approved position", () => {
    const next = nextAssignmentFormRates({
      positionChanged: true,
      currentDailyRate: "",
      card: {
        payroll_daily_rate: "723.0800",
        billing_daily_rate: "910.5000",
      },
    });
    assert.deepEqual(next, {
      daily_rate: "723.08",
      billing_daily_rate: "910.5",
    });
  });

  it("shows an explicit zero billing rate from the card", () => {
    const next = nextAssignmentFormRates({
      positionChanged: true,
      currentDailyRate: "",
      card: {
        payroll_daily_rate: "723.0800",
        billing_daily_rate: "0.0000",
      },
    });
    assert.equal(next.daily_rate, "723.08");
    assert.equal(next.billing_daily_rate, "0");
  });

  it("fills a blank payroll rate when the position is already selected", () => {
    const next = nextAssignmentFormRates({
      positionChanged: false,
      currentDailyRate: "",
      card: {
        payroll_daily_rate: 723.08,
        billing_daily_rate: 910,
      },
    });
    assert.equal(next.daily_rate, "723.08");
    assert.equal(next.billing_daily_rate, "910");
  });

  it("keeps a payroll rate already on the form when the same position refreshes", () => {
    const next = nextAssignmentFormRates({
      positionChanged: false,
      currentDailyRate: "800",
      card: {
        payroll_daily_rate: 723.08,
        billing_daily_rate: 910,
      },
    });
    assert.equal(next.daily_rate, "800");
    assert.equal(next.billing_daily_rate, "910");
  });

  it("replaces payroll when the position changes", () => {
    const next = nextAssignmentFormRates({
      positionChanged: true,
      currentDailyRate: "800",
      card: {
        payroll_daily_rate: 695,
        billing_daily_rate: 750,
      },
    });
    assert.deepEqual(next, {
      daily_rate: "695",
      billing_daily_rate: "750",
    });
  });

  it("clears billing when the position is cleared", () => {
    const next = nextAssignmentFormRates({
      positionChanged: true,
      currentDailyRate: "723.08",
      card: null,
    });
    assert.deepEqual(next, {
      daily_rate: "",
      billing_daily_rate: "",
    });
  });
});

describe("hirePlacementRatePreview", () => {
  it("shows payroll and zero billing from the Conrad Hr Assistant card", () => {
    assert.deepEqual(
      hirePlacementRatePreview({
        payroll_daily_rate: "695.0000",
        billing_daily_rate: "0.0000",
      }),
      { daily_rate: "695", billing_daily_rate: "0" }
    );
  });

  it("hides the preview when payroll is missing", () => {
    assert.equal(
      hirePlacementRatePreview({
        payroll_daily_rate: null,
        billing_daily_rate: "910",
      }),
      null
    );
  });
});

describe("hirePositionOptionLabel", () => {
  it("appends payroll and billing for salary-access hire pickers", () => {
    assert.equal(
      hirePositionOptionLabel({
        jobTitle: "Hr Assistant",
        showRates: true,
        card: {
          payroll_daily_rate: "695.0000",
          billing_daily_rate: "0.0000",
        },
      }),
      "Hr Assistant · 695 / bill 0"
    );
  });

  it("keeps the title only when rates are hidden", () => {
    assert.equal(
      hirePositionOptionLabel({
        jobTitle: "Driver",
        showRates: false,
        card: { payroll_daily_rate: 500, billing_daily_rate: 600 },
      }),
      "Driver"
    );
  });
});
