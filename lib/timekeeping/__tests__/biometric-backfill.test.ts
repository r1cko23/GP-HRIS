import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UNMAPPED_SKIP_REASON } from "../biometric-unmapped";
import {
  backfillMapKey,
  selectMappedSkipsForBackfill,
} from "../biometric-backfill";

describe("selectMappedSkipsForBackfill", () => {
  const from = "2026-09-15T16:00:00.000Z"; // Sep 16 Manila
  const device = "dev-1";
  const mapped = new Set([backfillMapKey(device, "7"), backfillMapKey(device, "22")]);

  it("keeps unmapped skips for mapped PINs from Sep 16 Manila onward, oldest first", () => {
    const selected = selectMappedSkipsForBackfill(
      [
        {
          id: "b",
          device_id: device,
          device_user_id: "7",
          punched_at: "2026-09-21T01:42:06.000Z",
          status_code: 0,
          raw_line: "7\t...",
          skip_reason: UNMAPPED_SKIP_REASON,
        },
        {
          id: "a",
          device_id: device,
          device_user_id: "22",
          punched_at: "2026-09-20T23:52:21.000Z",
          status_code: 0,
          raw_line: "22\t...",
          skip_reason: UNMAPPED_SKIP_REASON,
        },
        {
          id: "old",
          device_id: device,
          device_user_id: "7",
          punched_at: "2026-09-10T01:00:00.000Z",
          status_code: 0,
          raw_line: "7\t...",
          skip_reason: UNMAPPED_SKIP_REASON,
        },
        {
          id: "unmapped",
          device_id: device,
          device_user_id: "999",
          punched_at: "2026-09-21T01:00:00.000Z",
          status_code: 0,
          raw_line: "999\t...",
          skip_reason: UNMAPPED_SKIP_REASON,
        },
        {
          id: "stale",
          device_id: device,
          device_user_id: "7",
          punched_at: "2026-09-21T02:00:00.000Z",
          status_code: 0,
          raw_line: "7\t...",
          skip_reason: "Pre-2026 or stale ATTLOG buffer (ignored)",
        },
      ],
      mapped,
      from
    );

    assert.deepEqual(
      selected.map((e) => e.id),
      ["a", "b"]
    );
  });
});
