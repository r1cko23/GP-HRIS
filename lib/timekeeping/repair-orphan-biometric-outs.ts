/**
 * Plan repairs when a biometric punch event was logged as clock_out and linked
 * to a time_clock_entries row, but clock_out_time was never written.
 */

import {
  BIOMETRIC_DEVICE_LABEL,
  BIOMETRIC_FINGERPRINT,
} from "./zkteco-attlog";

export const ORPHAN_OUT_REPAIR_NOTE =
  "Repaired: applied orphan biometric OUT from punch event (entry was left open)";

export type OrphanOutPunch = {
  id: string;
  time_clock_entry_id: string;
  punched_at: string;
  action: string;
};

export type OrphanOutEntry = {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: string | null;
  status: string | null;
  hr_notes: string | null;
};

export type OrphanOutRepair = {
  entryId: string;
  eventId: string;
  clockOutTime: string;
  update: {
    clock_out_time: string;
    clock_out_device: string;
    clock_out_fingerprint: string;
    clock_out_location: string | null;
    status: "clocked_out";
    hr_notes: string;
  };
};

function appendNote(existing: string | null, note: string): string {
  const cur = (existing ?? "").trim();
  if (!cur) return note;
  if (cur.includes(note)) return cur;
  return `${cur}\n${note}`;
}

/**
 * Earliest valid OUT punch per open entry. Skips punches at/before clock-in
 * and entries that already have an out.
 */
export function planOrphanBiometricOutRepairs(
  punches: OrphanOutPunch[],
  entries: OrphanOutEntry[]
): OrphanOutRepair[] {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const bestByEntry = new Map<string, OrphanOutPunch>();

  for (const p of punches) {
    if (p.action !== "clock_out" || !p.time_clock_entry_id) continue;
    const entry = entryById.get(p.time_clock_entry_id);
    if (!entry) continue;
    if (entry.clock_out_time) continue;
    const inMs = Date.parse(entry.clock_in_time);
    const outMs = Date.parse(p.punched_at);
    if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) continue;

    const prev = bestByEntry.get(entry.id);
    if (!prev || Date.parse(p.punched_at) < Date.parse(prev.punched_at)) {
      bestByEntry.set(entry.id, p);
    }
  }

  const repairs: OrphanOutRepair[] = [];
  for (const [entryId, punch] of bestByEntry) {
    const entry = entryById.get(entryId)!;
    repairs.push({
      entryId,
      eventId: punch.id,
      clockOutTime: punch.punched_at,
      update: {
        clock_out_time: punch.punched_at,
        clock_out_device: BIOMETRIC_DEVICE_LABEL,
        clock_out_fingerprint: BIOMETRIC_FINGERPRINT,
        clock_out_location: entry.clock_in_location,
        status: "clocked_out",
        hr_notes: appendNote(entry.hr_notes, ORPHAN_OUT_REPAIR_NOTE),
      },
    });
  }

  repairs.sort((a, b) => a.entryId.localeCompare(b.entryId));
  return repairs;
}
