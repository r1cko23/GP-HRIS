import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextCutoffFromCalendar,
  resolveCalendarDay,
  windowsForMonth,
  type ClientPayCalendar,
} from "../client-pay-calendar";

const organic: ClientPayCalendar = {
  cut1_start: 1,
  cut1_end: 15,
  cut2_start: 16,
  cut2_end: 30,
  pay_frequency: "semi-monthly",
};

describe("resolveCalendarDay", () => {
  it("treats stored 30 as last day in a 31-day month", () => {
    assert.equal(resolveCalendarDay(2026, 7, 30, 30), 31);
  });

  it("keeps 15 as the 15th", () => {
    assert.equal(resolveCalendarDay(2026, 9, 15, 15), 15);
  });

  it("uses February last day for stored 30", () => {
    assert.equal(resolveCalendarDay(2026, 2, 30, 30), 28);
  });
});

describe("windowsForMonth", () => {
  it("opens Organic September as 1–15 and 16–30", () => {
    const [first, second] = windowsForMonth(organic, 2026, 9);
    assert.equal(first.period_start, "2026-09-01");
    assert.equal(first.period_end, "2026-09-15");
    assert.equal(first.payroll_date, "2026-09-20");
    assert.equal(first.window, "first");
    assert.equal(second.period_start, "2026-09-16");
    assert.equal(second.period_end, "2026-09-30");
    assert.equal(second.payroll_date, "2026-10-05");
  });

  it("opens Organic July second window through the 31st", () => {
    const [, second] = windowsForMonth(organic, 2026, 7);
    assert.equal(second.period_start, "2026-07-16");
    assert.equal(second.period_end, "2026-07-31");
    assert.equal(second.payroll_date, "2026-08-05");
  });
});

describe("nextCutoffFromCalendar", () => {
  it("proposes Sep 1–15 after posted Aug 16–31", () => {
    const next = nextCutoffFromCalendar(
      organic,
      [{ period_start: "2026-08-16", period_end: "2026-08-31" }],
      "2026-09-01"
    );
    assert.equal(next?.period_start, "2026-09-01");
    assert.equal(next?.period_end, "2026-09-15");
    assert.equal(next?.payroll_date, "2026-09-20");
    assert.equal(next?.window, "first");
  });

  it("uses the window containing today when none exist", () => {
    const next = nextCutoffFromCalendar(organic, [], "2026-09-01");
    assert.equal(next?.period_start, "2026-09-01");
    assert.equal(next?.period_end, "2026-09-15");
  });
});
