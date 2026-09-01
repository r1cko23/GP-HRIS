import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOfficeRegularHoursForCutoff,
  mapAttendanceToPremiumBuckets,
} from "../office-cutoff-hours-from-clock";

describe("computeOfficeRegularHoursForCutoff", () => {
  it("uses base-pay hours for office staff instead of raw clock regular hours", () => {
    const periodStart = new Date("2026-08-16T00:00:00.000Z");
    const periodEnd = new Date("2026-08-31T00:00:00.000Z");

    const clockEntries = [
      {
        employee_id: "e1",
        clock_in_time: "2026-08-17T01:00:00.000Z",
        clock_out_time: "2026-08-17T10:00:00.000Z",
        total_hours: 8,
        regular_hours: 8,
        overtime_hours: 0,
        total_night_diff_hours: 0,
        status: "clocked_out",
      },
      {
        employee_id: "e1",
        clock_in_time: "2026-08-18T01:00:00.000Z",
        clock_out_time: "2026-08-18T10:00:00.000Z",
        total_hours: 8,
        regular_hours: 8,
        overtime_hours: 0,
        total_night_diff_hours: 0,
        status: "clocked_out",
      },
    ];

    const result = computeOfficeRegularHoursForCutoff({
      periodStart,
      periodEnd,
      clockEntries,
      holidays: [],
      leaveRows: [],
      isClientBased: false,
      isAccountSupervisor: false,
    });

    assert.ok(result.actual_regular_hours >= 16);
    assert.ok(result.actual_regular_hours > 16);
  });

  it("treats no time entries as full absence against the 104h cap", () => {
    const periodStart = new Date("2026-08-16T00:00:00.000Z");
    const periodEnd = new Date("2026-08-31T00:00:00.000Z");

    const result = computeOfficeRegularHoursForCutoff({
      periodStart,
      periodEnd,
      clockEntries: [],
      holidays: [],
      leaveRows: [],
      isClientBased: false,
      isAccountSupervisor: false,
    });

    // Office Aug 16–31: 11 Mon–Fri workdays × 8 = 88 absent → Reg = 16
    assert.equal(result.actual_regular_hours, 16);
  });
});

describe("mapAttendanceToPremiumBuckets", () => {
  it("counts worked rest-day hours separately from regular", () => {
    const entriesByDate = new Map([
      [
        "2026-08-23",
        [
          {
            employee_id: "e1",
            clock_in_time: "2026-08-23T01:00:00.000Z",
            clock_out_time: "2026-08-23T10:00:00.000Z",
            total_hours: 8,
            regular_hours: 8,
            overtime_hours: 0,
            total_night_diff_hours: 0,
            status: "clocked_out",
          },
        ],
      ],
    ]);

    const buckets = mapAttendanceToPremiumBuckets(
      [
        {
          date: "2026-08-23",
          dayType: "sunday",
          regularHours: 8,
          overtimeHours: 0,
          nightDiffHours: 0,
        },
      ],
      entriesByDate
    );

    assert.equal(buckets.rest_day_hours, 8);
    assert.equal(buckets.legal_holiday_hours, 0);
  });
});
