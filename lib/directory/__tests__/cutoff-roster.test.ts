import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCutoffRosterRow } from "../cutoff-roster";

describe("isCutoffRosterRow", () => {
  const periodStart = "2026-09-01";
  const periodEnd = "2026-09-15";

  it("includes active overlapping Engagements", () => {
    assert.equal(
      isCutoffRosterRow(
        { status: "active", hire_date: "2024-01-01", resign_date: null },
        periodStart,
        periodEnd
      ),
      true
    );
  });

  it("excludes for_release even without a resign date", () => {
    assert.equal(
      isCutoffRosterRow(
        { status: "for_release", hire_date: "2025-06-30", resign_date: null },
        periodStart,
        periodEnd
      ),
      false
    );
  });

  it("excludes for_release even when resign falls in the window", () => {
    assert.equal(
      isCutoffRosterRow(
        {
          status: "for_release",
          hire_date: "2025-06-30",
          resign_date: "2026-09-10",
        },
        periodStart,
        periodEnd
      ),
      false
    );
  });

  it("includes a hire on period start", () => {
    assert.equal(
      isCutoffRosterRow(
        { status: "active", hire_date: "2026-09-01", resign_date: null },
        periodStart,
        periodEnd
      ),
      true
    );
  });

  it("excludes inactive, superseded, and hires after the window", () => {
    assert.equal(
      isCutoffRosterRow(
        { status: "inactive", hire_date: "2020-01-01", resign_date: "2026-08-31" },
        periodStart,
        periodEnd
      ),
      false
    );
    assert.equal(
      isCutoffRosterRow(
        {
          status: "active",
          hire_date: "2020-01-01",
          is_current_engagement: false,
        },
        periodStart,
        periodEnd
      ),
      false
    );
    assert.equal(
      isCutoffRosterRow(
        { status: "active", hire_date: "2026-09-16", resign_date: null },
        periodStart,
        periodEnd
      ),
      false
    );
  });
});
