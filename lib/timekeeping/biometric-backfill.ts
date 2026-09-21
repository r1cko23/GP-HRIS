/**
 * Select skipped ATTLOG events that now have a PIN map, oldest first.
 * Used to backfill Entries after HR maps terminal users.
 */

import { UNMAPPED_SKIP_REASON } from "./biometric-unmapped";

export type SkippedPunchHint = {
  id: string;
  device_id: string;
  device_user_id: string;
  punched_at: string;
  status_code: number | null;
  raw_line: string;
  skip_reason: string | null;
};

/** Key used in mapped-set lookups: `${deviceId}::${deviceUserId}` */
function mapKey(deviceId: string, deviceUserId: string): string {
  return `${deviceId}::${deviceUserId}`;
}

/**
 * Keep only unmapped skips that now have a map, from `fromIso` onward, chronological.
 */
export function selectMappedSkipsForBackfill(
  events: SkippedPunchHint[],
  mappedKeys: Set<string>,
  fromIso: string
): SkippedPunchHint[] {
  return events
    .filter((ev) => {
      if (ev.skip_reason !== UNMAPPED_SKIP_REASON) return false;
      if (ev.punched_at < fromIso) return false;
      const pin = (ev.device_user_id ?? "").trim();
      const deviceId = (ev.device_id ?? "").trim();
      if (!pin || !deviceId) return false;
      return mappedKeys.has(mapKey(deviceId, pin));
    })
    .sort((a, b) => {
      const t = a.punched_at.localeCompare(b.punched_at);
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });
}

export { mapKey as backfillMapKey };
