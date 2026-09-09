import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planLoanImportSchedules } from "../import-schedules";

describe("planLoanImportSchedules", () => {
  it("inserts unpaid catalog periods when the loan has no GP schedule yet", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: ["2026-09-01", "2026-09-16"],
      existing: [],
      postedPeriodStarts: [],
    });
    assert.deepEqual(plan.insertStarts, ["2026-09-01", "2026-09-16"]);
  });

  it("does not re-insert a period that is already skipped or paid", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: [
        "2026-09-01",
        "2026-09-16",
        "2026-10-01",
      ],
      existing: [
        { period_start: "2026-09-01", status: "skipped" },
        { period_start: "2026-09-16", status: "paid" },
      ],
      postedPeriodStarts: [],
    });
    assert.deepEqual(plan.insertStarts, ["2026-10-01"]);
  });

  it("still replaces pending rows after the caller deletes them", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: ["2026-09-01"],
      existing: [{ period_start: "2026-09-01", status: "pending" }],
      postedPeriodStarts: [],
    });
    assert.deepEqual(plan.insertStarts, ["2026-09-01"]);
  });

  it("skips a period already posted on a payroll run", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: ["2026-08-16", "2026-09-01"],
      existing: [],
      postedPeriodStarts: ["2026-08-16"],
    });
    assert.deepEqual(plan.insertStarts, ["2026-09-01"]);
  });

  it("keeps one row when GREENHRISMAIN repeats the same period_start", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: ["2026-09-01", "2026-09-01"],
      existing: [],
      postedPeriodStarts: [],
    });
    assert.deepEqual(plan.insertStarts, ["2026-09-01"]);
  });

  it("inserts nothing when every unpaid period is already skipped", () => {
    const plan = planLoanImportSchedules({
      unpaidPeriodStarts: ["2026-09-01", "2026-09-16"],
      existing: [
        { period_start: "2026-09-01", status: "skipped" },
        { period_start: "2026-09-16", status: "skipped" },
      ],
      postedPeriodStarts: [],
    });
    assert.deepEqual(plan.insertStarts, []);
  });
});
