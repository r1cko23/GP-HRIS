import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendancePrintEntryLabel,
  buildAttendancePrintHtml,
} from "../attendance-print";

const totals = { bh: "8.0", late: "0", ot: "0", ut: "0", nd: "0" };

describe("attendancePrintEntryLabel", () => {
  it("joins punch times and marks a missing clock out", () => {
    assert.equal(attendancePrintEntryLabel([]), "—");
    assert.equal(
      attendancePrintEntryLabel([
        {
          clockInTime: new Date(2026, 8, 16, 7, 32).toISOString(),
          clockOutTime: new Date(2026, 8, 16, 19, 32).toISOString(),
        },
        {
          clockInTime: new Date(2026, 8, 16, 20, 0).toISOString(),
          clockOutTime: null,
        },
      ]),
      "7:32 AM – 7:32 PM; 8:00 PM – no clock out"
    );
  });
});

describe("buildAttendancePrintHtml", () => {
  it("prints one employee day with punch times and totals", () => {
    const html = buildAttendancePrintHtml({
      employeeName: "Alberto, Jonathan C.",
      employeeCode: "202401-00001",
      rangeLabel: "Sep 16, 2026 – Sep 30, 2026",
      daysWork: "1.00",
      totals,
      rows: [
        {
          dateLabel: "Sep 16",
          entries: "7:32 AM – 7:32 PM",
          dayName: "Wednesday",
          status: "LOG",
          bh: "9.0",
          late: "—",
          ot: "—",
          ut: "—",
          nd: "—",
        },
      ],
    });

    assert.match(html, /Attendance/);
    assert.match(html, /Alberto, Jonathan C\./);
    assert.match(html, /202401-00001/);
    assert.match(html, /Sep 16, 2026 – Sep 30, 2026/);
    assert.match(html, /7:32 AM – 7:32 PM/);
    assert.match(html, /Days work: 1\.00/);
    assert.match(html, /window\.print/);
    assert.match(html, /size: letter landscape/);
  });

  it("escapes names and shows an empty range", () => {
    const html = buildAttendancePrintHtml({
      employeeName: "Dela Cruz <script>",
      employeeCode: "A&B",
      rangeLabel: "Sep 1, 2026 – Sep 15, 2026",
      daysWork: "0.00",
      totals: { bh: "0", late: "0", ot: "0", ut: "0", nd: "0" },
      rows: [],
    });

    assert.match(html, /Dela Cruz &lt;script&gt;/);
    assert.doesNotMatch(html, /<script>Dela/);
    assert.match(html, /A&amp;B/);
    assert.match(html, /No attendance in this range/);
  });
});
