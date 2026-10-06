import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseTimesheetPayFormat,
  timesheetPayFormatLabel,
} from "../timesheet-pay-format";

describe("parseTimesheetPayFormat", () => {
  it("accepts the standing site formats", () => {
    for (const format of [0, 7, 10, 11, 12, 13]) {
      assert.equal(parseTimesheetPayFormat(format), format);
      assert.equal(parseTimesheetPayFormat(String(format)), format);
    }
  });

  it("treats an empty value as unset", () => {
    assert.equal(parseTimesheetPayFormat(null), null);
    assert.equal(parseTimesheetPayFormat(""), null);
    assert.equal(parseTimesheetPayFormat(undefined), null);
  });

  it("rejects a format that is not a site timesheet size", () => {
    assert.equal(parseTimesheetPayFormat(8), null);
    assert.equal(parseTimesheetPayFormat(1), null);
    assert.equal(parseTimesheetPayFormat(13.5), null);
    assert.equal(parseTimesheetPayFormat("13 days"), null);
  });
});

describe("timesheetPayFormatLabel", () => {
  it("names daily, weekly, and workday caps", () => {
    assert.equal(timesheetPayFormatLabel(0), "Daily — no fixed workday cap");
    assert.equal(timesheetPayFormatLabel(7), "Weekly — 7 rows, 56 regular hours");
    assert.equal(timesheetPayFormatLabel(13), "13 workdays — 104 regular hours");
    assert.equal(timesheetPayFormatLabel(null), "Not set");
  });
});
