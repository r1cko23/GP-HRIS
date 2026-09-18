/**
 * ZKTeco ADMS ATTLOG parsing and punch-action rules (MB10-VL / Push protocol).
 * Device timestamps are wall-clock Asia/Manila unless noted otherwise.
 */

export type ZkAttlogRow = {
  deviceUserId: string;
  punchedAtLocal: string; // "YYYY-MM-DD HH:mm:ss" as sent by device
  statusCode: number | null;
  rawLine: string;
};

export type PunchAction = "clock_in" | "clock_out" | "ignore";

/** ZK status: 0 Check-In, 1 Check-Out; other codes treated by open-entry pairing.
 * Many MB10 punches send status 0 even for the second punch of the day — if an
 * open entry exists, treat that as clock-out so live pairing works.
 */
export function decidePunchAction(
  statusCode: number | null,
  hasOpenEntry: boolean
): PunchAction {
  if (statusCode === 1) return "clock_out";
  if (statusCode === 0) {
    return hasOpenEntry ? "clock_out" : "clock_in";
  }
  // Verify-only / unknown: pair on whether an open IN exists
  return hasOpenEntry ? "clock_out" : "clock_in";
}

/**
 * Parse ATTLOG body. Lines are tab- or whitespace-separated:
 * PIN  YYYY-MM-DD HH:MM:SS  Status  ...
 */
export function parseAttlogBody(body: string): ZkAttlogRow[] {
  const rows: ZkAttlogRow[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\t+/);
    const fields =
      parts.length >= 2 ? parts : trimmed.split(/\s+/).filter(Boolean);
    if (fields.length < 2) continue;

    const deviceUserId = fields[0]?.trim();
    if (!deviceUserId) continue;

    let punchedAtLocal: string;
    let statusIdx: number;

    // "YYYY-MM-DD HH:MM:SS" may be one field or two
    if (/^\d{4}-\d{2}-\d{2}$/.test(fields[1] ?? "") && fields[2]) {
      punchedAtLocal = `${fields[1]} ${fields[2]}`;
      statusIdx = 3;
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(fields[1] ?? "")) {
      punchedAtLocal = fields[1];
      statusIdx = 2;
    } else {
      continue;
    }

    const statusRaw = fields[statusIdx];
    const statusCode =
      statusRaw !== undefined && statusRaw !== "" && !Number.isNaN(Number(statusRaw))
        ? Number(statusRaw)
        : null;

    rows.push({
      deviceUserId,
      punchedAtLocal,
      statusCode,
      rawLine: trimmed,
    });
  }
  return rows;
}

/** Interpret device local time as Asia/Manila wall clock → UTC ISO. */
export function manilaLocalToIso(punchedAtLocal: string): string | null {
  const m = punchedAtLocal
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  // Manila is UTC+8 with no DST
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h) - 8,
    Number(mi),
    Number(s)
  );
  if (Number.isNaN(utcMs)) return null;
  return new Date(utcMs).toISOString();
}

/**
 * ZK devices re-push the ATTLOG buffer after reconnect.
 * Accept any punch in calendar year 2026+; reject older years and >1 day future.
 */
export function isStaleAttlogPunch(
  punchedAtIso: string,
  nowMs = Date.now(),
  _maxAgeDays = 2,
  minYear = 2026
): boolean {
  const t = Date.parse(punchedAtIso);
  if (Number.isNaN(t)) return true;
  // punchedAtIso is UTC; device sent Manila wall clock shifted -8h, so year
  // on the ISO instant can be prior calendar day in UTC — use Manila year.
  const manilaYear = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(new Date(t))
  );
  if (manilaYear < minYear) return true;
  if (t - nowMs > 24 * 60 * 60 * 1000) return true;
  return false;
}

export const GREEN_PASTURE_LOCATION_NAME = "Green Pasture";

export const DEFAULT_MB10_SERIAL = "UDP3235201130";

/** ADMS ATTLOGStamp that tells the device to skip pre-2026 buffer replay. */
export const ATTLOG_STAMP_FROM_2026 = "2026-01-01 00:00:00";
