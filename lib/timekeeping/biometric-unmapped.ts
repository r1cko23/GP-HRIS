/**
 * Aggregate skipped ADMS punches that had no employee map into a work queue.
 * Device User IDs (PINs) appear here after someone punches — HR maps them in UI
 * without reading IDs off the terminal.
 */

export const UNMAPPED_SKIP_REASON = "No employee map for device user id";

export type PunchEventHint = {
  device_id: string;
  device_user_id: string;
  punched_at: string;
  skip_reason: string | null;
};

export type UnmappedPin = {
  deviceId: string;
  deviceUserId: string;
  punchCount: number;
  lastPunchedAt: string;
  displayName?: string;
};

/** Key used in mapped-set lookups: `${deviceId}::${deviceUserId}` */
export function mapKey(deviceId: string, deviceUserId: string): string {
  return `${deviceId}::${deviceUserId}`;
}

/**
 * Collapse punch events into distinct unmapped PINs, newest first.
 * `mappedKeys` is a set of mapKey(deviceId, pin) already linked to an employee.
 */
export function aggregateUnmappedPins(
  events: PunchEventHint[],
  mappedKeys: Set<string>
): UnmappedPin[] {
  const byKey = new Map<string, UnmappedPin>();

  for (const ev of events) {
    if (ev.skip_reason !== UNMAPPED_SKIP_REASON) continue;
    const pin = (ev.device_user_id ?? "").trim();
    const deviceId = (ev.device_id ?? "").trim();
    if (!pin || !deviceId) continue;
    if (mappedKeys.has(mapKey(deviceId, pin))) continue;

    const key = mapKey(deviceId, pin);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        deviceId,
        deviceUserId: pin,
        punchCount: 1,
        lastPunchedAt: ev.punched_at,
      });
      continue;
    }
    existing.punchCount += 1;
    if (ev.punched_at > existing.lastPunchedAt) {
      existing.lastPunchedAt = ev.punched_at;
    }
  }

  return [...byKey.values()].sort((a, b) =>
    b.lastPunchedAt.localeCompare(a.lastPunchedAt)
  );
}

export function filterAndPageUnmapped(
  rows: UnmappedPin[],
  opts: { q?: string; limit: number; offset: number }
): { data: UnmappedPin[]; count: number; limit: number; offset: number } {
  const q = opts.q?.trim().toLowerCase() ?? "";
  const filtered = q
    ? rows.filter(
        (r) =>
          r.deviceUserId.toLowerCase().includes(q) ||
          (r.displayName ?? "").toLowerCase().includes(q)
      )
    : rows;
  const limit = Math.min(Math.max(opts.limit, 1), 200);
  const offset = Math.max(opts.offset, 0);
  return {
    data: filtered.slice(offset, offset + limit),
    count: filtered.length,
    limit,
    offset,
  };
}
