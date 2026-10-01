import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildManualDtrSave,
  computeOrganicDtrLine,
  cutoffHasBundyOrDevicePunch,
  manualDtrHolidayMark,
  manualDtrRateLabel,
  visibleDtrOt,
  isManualDtrEmployee,
  manualDtrDateKeys,
  manualDtrIdsToReplace,
  MANUAL_DTR_REASON,
} from "../manual-dtr";

const NOW = Date.parse("2026-09-30T10:00:00.000Z");

describe("manual DTR eligibility", () => {
  it("opens the sheet only when the employee has no biometric map and no bundy or device punch", () => {
    assert.equal(
      isManualDtrEmployee({ biometricMapped: false, hasBundyOrDevicePunch: false }),
      true
    );
    assert.equal(
      isManualDtrEmployee({ biometricMapped: true, hasBundyOrDevicePunch: false }),
      false
    );
    assert.equal(
      isManualDtrEmployee({ biometricMapped: false, hasBundyOrDevicePunch: true }),
      false
    );
  });

  it("treats a manual DTR punch as not bundy, and a device punch as bundy", () => {
    assert.equal(
      cutoffHasBundyOrDevicePunch([{ is_manual_entry: true }, { is_manual_entry: true }]),
      false
    );
    assert.equal(cutoffHasBundyOrDevicePunch([]), false);
    assert.equal(
      cutoffHasBundyOrDevicePunch([{ is_manual_entry: false }, { is_manual_entry: true }]),
      true
    );
  });
});

describe("13-day cutoff grid", () => {
  it("lists every calendar day in the second semi-monthly cutoff", () => {
    const keys = manualDtrDateKeys(new Date(2026, 8, 16), new Date(2026, 8, 30));
    assert.equal(keys.length, 15);
    assert.equal(keys[0], "2026-09-16");
    assert.equal(keys[keys.length - 1], "2026-09-30");
    assert.equal(keys.filter((key) => key === "2026-09-20").length, 1);
  });
});

describe("organic DTR hours", () => {
  it("pays 8 regular hours for 08:00–17:00 and no overtime", () => {
    const line = computeOrganicDtrLine({ timeIn: "08:00", timeOut: "17:00" });
    assert.equal(line.regularHours, 8);
    assert.equal(line.otInHours, 0);
    assert.equal(line.otOutHours, 0);
    assert.equal(line.invalidOrder, false);
  });

  it("counts early time in as OT in and time after 17:00 as OT out", () => {
    const line = computeOrganicDtrLine({ timeIn: "07:00", timeOut: "19:00" });
    assert.equal(line.regularHours, 8);
    assert.equal(line.otInHours, 1);
    assert.equal(line.otOutHours, 2);
  });

  it("shows OT in and OT out only after OK is checked", () => {
    const line = computeOrganicDtrLine({ timeIn: "07:30", timeOut: "18:00" });
    assert.equal(line.otInHours, 0.5);
    assert.equal(line.otOutHours, 1);
    assert.equal(visibleDtrOt(line.otInHours, false), 0);
    assert.equal(visibleDtrOt(line.otOutHours, false), 0);
    assert.equal(visibleDtrOt(line.otInHours, true), 0.5);
    assert.equal(visibleDtrOt(line.otOutHours, true), 1);
  });

  it("splits regular hours around the duty set for that day", () => {
    const line = computeOrganicDtrLine({
      timeIn: "08:00",
      timeOut: "19:00",
      dutyStart: "09:00",
      dutyEnd: "18:00",
    });
    assert.equal(line.regularHours, 8);
    assert.equal(line.otInHours, 1);
    assert.equal(line.otOutHours, 1);
    assert.equal(line.lateMinutes, 0);
  });

  it("does not deduct lunch from a short morning", () => {
    const line = computeOrganicDtrLine({ timeIn: "08:00", timeOut: "12:00" });
    assert.equal(line.regularHours, 4);
    assert.equal(line.otOutHours, 0);
  });
});

describe("manual DTR holiday and leave tags", () => {
  const holidays = [
    { date: "2026-08-21", name: "Ninoy Aquino Day", type: "regular" as const },
    { date: "2026-08-31", name: "National Heroes Day", type: "non-working" as const },
  ];

  it("marks a regular holiday as RH and a special holiday as SH", () => {
    assert.deepEqual(manualDtrHolidayMark("2026-08-21", holidays), {
      code: "RH",
      name: "Ninoy Aquino Day",
    });
    assert.deepEqual(manualDtrHolidayMark("2026-08-31", holidays), {
      code: "SH",
      name: "National Heroes Day",
    });
    assert.equal(manualDtrHolidayMark("2026-08-22", holidays), null);
  });

  it("labels rest day and working day off at 130%", () => {
    assert.equal(manualDtrRateLabel("RD"), "Rest day · 130%");
    assert.equal(manualDtrRateLabel("WDO"), "WDO · 130%");
    assert.equal(manualDtrRateLabel(""), null);
  });

  it("saves worked WDO hours on the clock and keeps a rest day off the clock", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-20",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
          leaveTag: "WDO",
        },
        {
          date: "2026-09-21",
          timeIn: "",
          timeOut: "",
          otInOk: false,
          otOutOk: false,
          locked: false,
          leaveTag: "RD",
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.clockRows[0].employee_notes, "Manual DTR WDO");
    assert.equal(saved.leaveRows.length, 0);
    assert.deepEqual(saved.restDays, ["2026-09-20", "2026-09-21"]);
  });

  it("records SIL as paid leave and LWOP as unpaid leave, without a clock", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
          leaveTag: "SIL",
        },
        {
          date: "2026-09-17",
          timeIn: "",
          timeOut: "",
          otInOk: false,
          otOutOk: false,
          locked: false,
          leaveTag: "LWOP",
        },
      ],
    });
    assert.equal("leaveRows" in saved, true);
    if (!("leaveRows" in saved)) return;
    assert.equal(saved.clockRows.length, 0);
    assert.equal(saved.leaveRows.length, 2);
    assert.equal(saved.leaveRows[0].leave_type, "SIL");
    assert.equal(saved.leaveRows[0].status, "approved_by_hr");
    assert.equal(saved.leaveRows[0].total_days, 1);
    assert.deepEqual(saved.leaveRows[0].selected_dates, ["2026-09-16"]);
    assert.equal(saved.leaveRows[1].leave_type, "LWOP");
    assert.equal(saved.leaveRows[1].start_date, "2026-09-17");
  });
});

describe("manual DTR save", () => {
  it("writes a manual clock and an approved OT out only when OT OK is checked", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "19:00",
          otInOk: false,
          otOutOk: true,
          locked: false,
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.clockRows[0].is_manual_entry, true);
    assert.equal(saved.clockRows[0].status, "auto_approved");
    assert.equal(saved.clockRows[0].employee_notes, MANUAL_DTR_REASON);
    assert.equal(saved.clockRows[0].clock_in_time, "2026-09-16T00:00:00.000Z");
    assert.equal(saved.clockRows[0].clock_out_time, "2026-09-16T11:00:00.000Z");
    assert.equal(saved.overtimeRows.length, 1);
    assert.equal(saved.overtimeRows[0].status, "approved");
    assert.equal(saved.overtimeRows[0].reason, MANUAL_DTR_REASON);
    assert.equal(saved.overtimeRows[0].total_hours, 2);
    assert.equal(saved.overtimeRows[0].start_time, "17:00:00");
    assert.equal(saved.overtimeRows[0].end_time, "19:00:00");
    assert.equal(saved.overtimeRows[0].ot_date, "2026-09-16");
  });

  it("saves the clock without an OT request when OT OK is off", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "07:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.overtimeRows.length, 0);
  });

  it("saves completed days when another day is still in the future", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: Date.parse("2026-09-30T08:00:00.000Z"),
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
        {
          date: "2026-09-30",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.clockRows[0].clock_in_time, "2026-09-16T00:00:00.000Z");
    assert.equal(saved.replaceDates.includes("2026-09-30"), false);
    assert.equal(saved.warnings.length, 1);
    assert.match(saved.warnings[0], /2026-09-30/);
    assert.match(saved.warnings[0], /future/i);
  });

  it("saves completed days when another day has only a time in", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
        {
          date: "2026-09-18",
          timeIn: "08:00",
          timeOut: "",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.replaceDates.includes("2026-09-18"), false);
    assert.match(saved.warnings[0], /2026-09-18/);
  });

  it("saves the duty chosen for a day, including a day with no time in or time out", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "19:00",
          dutyStart: "09:00",
          dutyEnd: "18:00",
          otInOk: true,
          otOutOk: true,
          locked: false,
        },
        {
          date: "2026-09-17",
          timeIn: "",
          timeOut: "",
          dutyStart: "10:00",
          dutyEnd: "19:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
      ],
    });
    assert.equal("dutyRows" in saved, true);
    if (!("dutyRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.equal(saved.overtimeRows.length, 2);
    assert.equal(saved.overtimeRows[0].end_time, "09:00:00");
    assert.equal(saved.overtimeRows[1].start_time, "18:00:00");
    assert.deepEqual(
      saved.dutyRows.map((duty) => [duty.date, duty.start_time, duty.end_time]),
      [
        ["2026-09-16", "09:00:00", "18:00:00"],
        ["2026-09-17", "10:00:00", "19:00:00"],
      ]
    );
  });

  it("leaves out a day whose duty ends before it starts and still saves the other day", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "17:00",
          dutyStart: "08:00",
          dutyEnd: "17:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
        {
          date: "2026-09-18",
          timeIn: "08:00",
          timeOut: "17:00",
          dutyStart: "17:00",
          dutyEnd: "08:00",
          otInOk: false,
          otOutOk: false,
          locked: false,
        },
      ],
    });
    assert.equal("dutyRows" in saved, true);
    if (!("dutyRows" in saved)) return;
    assert.equal(saved.clockRows.length, 1);
    assert.deepEqual(saved.dutyRows.map((duty) => duty.date), ["2026-09-16"]);
    assert.match(saved.warnings[0], /2026-09-18/);
    assert.match(saved.warnings[0], /duty/i);
  });

  it("skips a blank day and rejects a half-filled day", () => {
    const blank = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        { date: "2026-09-16", timeIn: "", timeOut: "", otInOk: false, otOutOk: false, locked: false },
        { date: "2026-09-17", timeIn: "08:00", timeOut: "17:00", otInOk: false, otOutOk: false, locked: false },
      ],
    });
    assert.equal("clockRows" in blank, true);
    if (!("clockRows" in blank)) return;
    assert.equal(blank.clockRows.length, 1);
    assert.deepEqual(blank.replaceDates, ["2026-09-16", "2026-09-17"]);

    const half = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        { date: "2026-09-18", timeIn: "08:00", timeOut: "", otInOk: false, otOutOk: false, locked: false },
      ],
    });
    assert.equal("error" in half, true);
    if ("error" in half) assert.match(half.error, /2026-09-18/);
  });

  it("does not rewrite a day that already has a bundy or biometric punch", () => {
    const saved = buildManualDtrSave({
      employeeId: "emp-1",
      editorLabel: "HR",
      nowMs: NOW,
      rows: [
        {
          date: "2026-09-16",
          timeIn: "08:00",
          timeOut: "17:00",
          otInOk: true,
          otOutOk: true,
          locked: true,
        },
      ],
    });
    assert.equal("clockRows" in saved, true);
    if (!("clockRows" in saved)) return;
    assert.equal(saved.clockRows.length, 0);
    assert.equal(saved.overtimeRows.length, 0);
    assert.deepEqual(saved.replaceDates, []);
  });

  it("replaces prior manual DTR clocks and OT, and leaves bundy punches and filed OT", () => {
    const ids = manualDtrIdsToReplace({
      replaceDates: ["2026-09-16", "2026-09-17"],
      clocks: [
        { id: "manual-16", clock_in_time: "2026-09-16T00:00:00.000Z", is_manual_entry: true },
        { id: "bundy-17", clock_in_time: "2026-09-17T00:00:00.000Z", is_manual_entry: false },
      ],
      overtime: [
        { id: "dtr-ot", ot_date: "2026-09-16", reason: MANUAL_DTR_REASON },
        { id: "filed-ot", ot_date: "2026-09-16", reason: "Client event" },
      ],
    });
    assert.deepEqual(ids.clockIds, ["manual-16"]);
    assert.deepEqual(ids.overtimeIds, ["dtr-ot"]);
  });
});
