/**
 * Punch review payloads shared by the attendance card.
 * Same rules as the former Time entries queue: out after in, no future times,
 * approve / reject / manual edit shapes.
 */

const CLOCK_TIME_FUTURE_SKEW_MS = 15 * 60 * 1000;

export type ClockEditUpdate = {
  clock_in_time: string;
  clock_out_time: string;
  is_manual_entry: true;
  status: "auto_approved";
  hr_notes: string;
};

export type ManualClockInsert = ClockEditUpdate & {
  employee_id: string;
  employee_notes: string | null;
};

function clockPairError(clockIn: Date, clockOut: Date, nowMs: number): string | null {
  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) {
    return "Please provide both clock in and clock out times";
  }
  if (clockOut.getTime() <= clockIn.getTime()) {
    return "Clock out time must be after clock in time";
  }
  const limit = nowMs + CLOCK_TIME_FUTURE_SKEW_MS;
  if (clockIn.getTime() > limit) return "Clock in time cannot be in the future.";
  if (clockOut.getTime() > limit) return "Clock out time cannot be in the future.";
  return null;
}

export function buildClockEditUpdate(input: {
  clockIn: Date;
  clockOut: Date;
  hrNotes: string;
  editorLabel: string;
  nowMs?: number;
}): { error: string } | { update: ClockEditUpdate } {
  const nowMs = input.nowMs ?? Date.now();
  const error = clockPairError(input.clockIn, input.clockOut, nowMs);
  if (error) return { error };
  const note = input.hrNotes.trim();
  return {
    update: {
      clock_in_time: input.clockIn.toISOString(),
      clock_out_time: input.clockOut.toISOString(),
      is_manual_entry: true,
      status: "auto_approved",
      hr_notes: note || `Time manually edited by ${input.editorLabel}`,
    },
  };
}

export function buildManualClockInsert(input: {
  employeeId: string;
  clockIn: Date;
  clockOut: Date;
  notes: string | null;
  editorLabel: string;
  nowMs?: number;
}): { error: string } | { row: ManualClockInsert } {
  const nowMs = input.nowMs ?? Date.now();
  const error = clockPairError(input.clockIn, input.clockOut, nowMs);
  if (error) return { error };
  const notes = input.notes?.trim() || null;
  return {
    row: {
      employee_id: input.employeeId,
      clock_in_time: input.clockIn.toISOString(),
      clock_out_time: input.clockOut.toISOString(),
      is_manual_entry: true,
      status: "auto_approved",
      employee_notes: notes,
      hr_notes: `Manually created by ${input.editorLabel}`,
    },
  };
}

export function buildApproveUpdate(hrNotes: string): {
  status: "approved";
  hr_notes: string | null;
} {
  const note = hrNotes.trim();
  return { status: "approved", hr_notes: note || null };
}

export function buildRejectUpdate(
  hrNotes: string
): { error: string } | { update: { status: "rejected"; hr_notes: string } } {
  const note = hrNotes.trim();
  if (!note) return { error: "Please provide a reason for rejection" };
  return { update: { status: "rejected", hr_notes: note } };
}

export type BulkClockRow = {
  date: string;
  timeIn: string;
  timeOut: string;
  notes: string;
};

export function buildBulkClockInserts(input: {
  employeeId: string;
  rows: BulkClockRow[];
  editorLabel: string;
  nowMs?: number;
}): { error: string } | { rows: ManualClockInsert[] } {
  const valid = input.rows.filter((row) => row.date && row.timeIn && row.timeOut);
  if (valid.length === 0) {
    return { error: "Please add at least one valid time entry" };
  }
  const built: ManualClockInsert[] = [];
  for (let index = 0; index < valid.length; index += 1) {
    const row = valid[index];
    const result = buildManualClockInsert({
      employeeId: input.employeeId,
      clockIn: new Date(`${row.date}T${row.timeIn}`),
      clockOut: new Date(`${row.date}T${row.timeOut}`),
      notes: row.notes || `Bulk imported - ${row.date}`,
      editorLabel: input.editorLabel,
      nowMs: input.nowMs,
    });
    if ("error" in result) return { error: `Row ${index + 1}: ${result.error}` };
    built.push({
      ...result.row,
      hr_notes: `Bulk created by ${input.editorLabel}`,
    });
  }
  return { rows: built };
}
