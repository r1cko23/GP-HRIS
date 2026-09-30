import { format } from "date-fns";

export function attendancePrintEntryLabel(
  punches: { clockInTime: string; clockOutTime: string | null }[]
): string {
  if (punches.length === 0) return "—";
  return punches
    .map((punch) => {
      const inn = format(new Date(punch.clockInTime), "h:mm a");
      const out = punch.clockOutTime
        ? format(new Date(punch.clockOutTime), "h:mm a")
        : "no clock out";
      return `${inn} – ${out}`;
    })
    .join("; ");
}

export type AttendancePrintRow = {
  dateLabel: string;
  entries: string;
  dayName: string;
  status: string;
  bh: string;
  late: string;
  ot: string;
  ut: string;
  nd: string;
};

export type AttendancePrintDocument = {
  employeeName: string;
  employeeCode: string;
  rangeLabel: string;
  rows: AttendancePrintRow[];
  daysWork: string;
  totals: {
    bh: string;
    late: string;
    ot: string;
    ut: string;
    nd: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(value: string, align: "left" | "center" | "right"): string {
  return `<td class="${align}">${escapeHtml(value)}</td>`;
}

/** Printable attendance sheet. The browser print dialog saves it as PDF. */
export function buildAttendancePrintHtml(doc: AttendancePrintDocument): string {
  const rows =
    doc.rows.length === 0
      ? `<tr><td class="center" colspan="9">No attendance in this range.</td></tr>`
      : doc.rows
          .map(
            (row) => `<tr>
              ${cell(row.dateLabel, "center")}
              ${cell(row.entries, "left")}
              ${cell(row.dayName, "center")}
              ${cell(row.status, "center")}
              ${cell(row.bh, "right")}
              ${cell(row.late, "right")}
              ${cell(row.ot, "right")}
              ${cell(row.ut, "right")}
              ${cell(row.nd, "right")}
            </tr>`
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Attendance · ${escapeHtml(doc.employeeName)}</title>
  <style>
    @page { size: letter landscape; margin: 0.5in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111;
      font-family: "Source Sans 3", "Source Sans Pro", sans-serif;
      font-size: 11px;
    }
    h1 { margin: 0; font-size: 18px; font-weight: 600; }
    p.meta { margin: 4px 0 0; color: #444; }
    table { width: 100%; margin-top: 16px; border-collapse: collapse; }
    th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { font-size: 10px; font-weight: 600; color: #444; }
    .left { text-align: left; }
    .center { text-align: center; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { border-top: 2px solid #111; border-bottom: 0; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Attendance</h1>
  <p class="meta">${escapeHtml(doc.employeeName)} · ${escapeHtml(doc.employeeCode)}</p>
  <p class="meta">${escapeHtml(doc.rangeLabel)}</p>
  <table>
    <thead>
      <tr>
        <th class="center">Date</th>
        <th class="left">Entries</th>
        <th class="center">Day</th>
        <th class="center">Status</th>
        <th class="right">BH</th>
        <th class="right">Late</th>
        <th class="right">OT</th>
        <th class="right">UT</th>
        <th class="right">ND</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td class="left" colspan="4">Days work: ${escapeHtml(doc.daysWork)}</td>
        ${cell(doc.totals.bh, "right")}
        ${cell(doc.totals.late, "right")}
        ${cell(doc.totals.ot, "right")}
        ${cell(doc.totals.ut, "right")}
        ${cell(doc.totals.nd, "right")}
      </tr>
    </tfoot>
  </table>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 200); });</script>
</body>
</html>`;
}
