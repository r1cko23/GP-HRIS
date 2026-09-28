import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OFFICE_DEFAULT_END,
  OFFICE_DEFAULT_START,
  SPECIAL_END,
  SPECIAL_START,
  getDefaultBusinessHours,
} from "../business-hours";

describe("getDefaultBusinessHours", () => {
  it("gives Andres Alfeche Mon–Sat 09:00–18:00", () => {
    const hours = getDefaultBusinessHours(
      {
        full_name: "Andres A. Alfeche Ii",
        employee_type: "office-based",
      },
      "2026-09-16",
      2 // Tuesday
    );
    assert.deepEqual(hours, {
      start_time: SPECIAL_START,
      end_time: SPECIAL_END,
    });
  });

  it("still matches Andres when the UI shows Last, First order", () => {
    const hours = getDefaultBusinessHours(
      {
        full_name: "Alfeche Ii, Andres A.",
        employee_type: "office-based",
      },
      "2026-09-16",
      2
    );
    assert.equal(hours?.start_time, SPECIAL_START);
    assert.equal(hours?.end_time, SPECIAL_END);
  });

  it("gives Michelle Razal Mon–Sat 09:00–18:00", () => {
    const hours = getDefaultBusinessHours(
      { full_name: "Michelle Razal", employee_type: "office-based" },
      "2026-09-16",
      2
    );
    assert.deepEqual(hours, {
      start_time: SPECIAL_START,
      end_time: SPECIAL_END,
    });
  });

  it("still matches Michelle when the UI shows Last, First order", () => {
    const hours = getDefaultBusinessHours(
      { full_name: "Razal, Michelle", employee_type: "office-based" },
      "2026-09-16",
      2
    );
    assert.equal(hours?.start_time, SPECIAL_START);
    assert.equal(hours?.end_time, SPECIAL_END);
  });

  it("uses 08:00–17:00 for other office staff", () => {
    const hours = getDefaultBusinessHours(
      { full_name: "Jericko Razal", employee_type: "office-based" },
      "2026-09-16",
      2
    );
    assert.deepEqual(hours, {
      start_time: OFFICE_DEFAULT_START,
      end_time: OFFICE_DEFAULT_END,
    });
  });

  it("does not treat the old Jon Alfeche label as 9–6", () => {
    const hours = getDefaultBusinessHours(
      { full_name: "Jon Alfeche", employee_type: "office-based" },
      "2026-09-16",
      2
    );
    assert.deepEqual(hours, {
      start_time: OFFICE_DEFAULT_START,
      end_time: OFFICE_DEFAULT_END,
    });
  });
});
