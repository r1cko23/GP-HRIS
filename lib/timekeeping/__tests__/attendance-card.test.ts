import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApproveUpdate,
  buildClockEditUpdate,
  buildManualClockInsert,
  buildRejectUpdate,
} from "../clock-entry-edits";
import {
  attendanceCardActionFlags,
  employeeIdsNeedingAttention,
  punchEntryPlaceLabel,
  punchEntryStatusLabel,
  punchHoursLabel,
  normalizeAttendanceDateRange,
  attendanceDaysInRange,
} from "../attendance-card";

const NOW = Date.parse("2026-09-15T04:00:00.000Z");

describe("employeeIdsNeedingAttention", () => {
  it("flags an employee with a punch still waiting for review", () => {
    const ids = employeeIdsNeedingAttention([
      {
        employeeId: "emp-1",
        status: "clocked_out",
        clockOutTime: "2026-09-01T09:00:00.000Z",
      },
      {
        employeeId: "emp-2",
        status: "approved",
        clockOutTime: "2026-09-01T09:00:00.000Z",
      },
    ]);
    assert.deepEqual(ids, ["emp-1"]);
  });

  it("flags an incomplete punch and ignores approved, rejected, and empty cutoffs", () => {
    assert.deepEqual(
      employeeIdsNeedingAttention([
        { employeeId: "open", status: "clocked_in", clockOutTime: null },
        {
          employeeId: "done",
          status: "auto_approved",
          clockOutTime: "2026-09-01T09:00:00.000Z",
        },
        {
          employeeId: "declined",
          status: "rejected",
          clockOutTime: null,
        },
      ]),
      ["open"]
    );
    assert.deepEqual(employeeIdsNeedingAttention([]), []);
  });

  it("lists each employee once when several punches need attention", () => {
    const ids = employeeIdsNeedingAttention([
      { employeeId: "emp-1", status: "clocked_out", clockOutTime: "2026-09-01T09:00:00.000Z" },
      { employeeId: "emp-1", status: "clocked_in", clockOutTime: null },
      { employeeId: "emp-3", status: "clocked_out", clockOutTime: "2026-09-02T09:00:00.000Z" },
    ]);
    assert.deepEqual(ids, ["emp-1", "emp-3"]);
  });
});

describe("attendance card punch actions", () => {
  it("never allows edit, remove, or add — review only when granted", () => {
    const flags = attendanceCardActionFlags({
      canUpdateTimeEntries: true,
    });
    assert.equal(flags.canEdit, false);
    assert.equal(flags.canRemove, false);
    assert.equal(flags.canAdd, false);
    assert.equal(flags.canReview, true);
  });

  it("disables review when the viewer cannot update time entries", () => {
    assert.equal(
      attendanceCardActionFlags({ canUpdateTimeEntries: false }).canReview,
      false
    );
  });
});

describe("punch entry details on the attendance card", () => {
  it("labels incomplete, review, and approved entry statuses", () => {
    assert.equal(
      punchEntryStatusLabel({ status: "clocked_in", clockOutTime: null }),
      "Incomplete"
    );
    assert.equal(
      punchEntryStatusLabel({
        status: "clocked_out",
        clockOutTime: "2026-09-02T15:59:00.000Z",
      }),
      "Needs review"
    );
    assert.equal(
      punchEntryStatusLabel({
        status: "approved",
        clockOutTime: "2026-09-02T15:59:00.000Z",
      }),
      "Approved"
    );
    assert.equal(
      punchEntryStatusLabel({
        status: "auto_approved",
        clockOutTime: "2026-09-02T15:59:00.000Z",
      }),
      "Auto approved"
    );
    assert.equal(
      punchEntryStatusLabel({
        status: "rejected",
        clockOutTime: "2026-09-02T15:59:00.000Z",
      }),
      "Rejected"
    );
  });

  it("prefers regular hours, then total hours, for the entry hours line", () => {
    assert.equal(punchHoursLabel({ regularHours: 6.2, totalHours: 14.1 }), "6.2h");
    assert.equal(punchHoursLabel({ regularHours: 0, totalHours: 3.5 }), "3.5h");
    assert.equal(punchHoursLabel({ regularHours: null, totalHours: null }), null);
  });

  it("formats place as name · address and skips empty GPS", () => {
    assert.equal(
      punchEntryPlaceLabel({
        name: "Green Pasture",
        address: "31st Floor, Unit 3101, AIC, Burgundy Tower",
        coordinates: "14.5,121.0",
      }),
      "Green Pasture · 31st Floor, Unit 3101, AIC, Burgundy Tower"
    );
    assert.equal(
      punchEntryPlaceLabel({
        name: "Green Pasture",
        address: "Green Pasture",
        coordinates: "14.5,121.0",
      }),
      "Green Pasture"
    );
    assert.equal(
      punchEntryPlaceLabel({
        name: "No GPS data",
        address: null,
        coordinates: null,
      }),
      null
    );
  });
});

describe("attendance free date range", () => {
  it("swaps inverted ranges and lists inclusive calendar days", () => {
    const range = normalizeAttendanceDateRange(
      new Date(2026, 8, 20),
      new Date(2026, 8, 16)
    );
    assert.equal(range.start.getFullYear(), 2026);
    assert.equal(range.start.getMonth(), 8);
    assert.equal(range.start.getDate(), 16);
    assert.equal(range.end.getDate(), 20);
    assert.equal(
      attendanceDaysInRange(new Date(2026, 8, 1), new Date(2026, 8, 3)).length,
      3
    );
  });
});

describe("clock entry edits", () => {
  it("rejects a clock out that is not after clock in", () => {
    const clockIn = new Date("2026-09-10T00:00:00.000Z");
    const result = buildClockEditUpdate({
      clockIn,
      clockOut: clockIn,
      hrNotes: "",
      editorLabel: "HR",
      nowMs: NOW,
    });
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.match(result.error, /after clock in/i);
    }
  });

  it("rejects a future clock in", () => {
    const result = buildManualClockInsert({
      employeeId: "emp-1",
      clockIn: new Date("2026-09-20T00:00:00.000Z"),
      clockOut: new Date("2026-09-20T09:00:00.000Z"),
      notes: null,
      editorLabel: "Admin",
      nowMs: NOW,
    });
    assert.equal("error" in result, true);
    if ("error" in result) {
      assert.match(result.error, /future/i);
    }
  });

  it("marks a valid edit auto-approved and keeps the note", () => {
    const result = buildClockEditUpdate({
      clockIn: new Date("2026-09-10T00:00:00.000Z"),
      clockOut: new Date("2026-09-10T09:00:00.000Z"),
      hrNotes: "Corrected bundy",
      editorLabel: "HR",
      nowMs: NOW,
    });
    assert.equal("update" in result, true);
    if ("update" in result) {
      assert.equal(result.update.status, "auto_approved");
      assert.equal(result.update.is_manual_entry, true);
      assert.equal(result.update.hr_notes, "Corrected bundy");
      assert.equal(result.update.clock_in_time, "2026-09-10T00:00:00.000Z");
    }
  });

  it("requires a reason before rejecting a punch", () => {
    const missing = buildRejectUpdate("  ");
    assert.equal("error" in missing, true);
    const ok = buildRejectUpdate("No photo");
    assert.equal("update" in ok, true);
    if ("update" in ok) {
      assert.equal(ok.update.status, "rejected");
      assert.equal(ok.update.hr_notes, "No photo");
    }
  });

  it("approves a punch and stores optional notes", () => {
    assert.deepEqual(buildApproveUpdate(""), {
      status: "approved",
      hr_notes: null,
    });
    assert.deepEqual(buildApproveUpdate("Verified"), {
      status: "approved",
      hr_notes: "Verified",
    });
  });
});
