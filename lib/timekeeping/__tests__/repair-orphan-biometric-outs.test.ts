import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORPHAN_OUT_REPAIR_NOTE,
  planOrphanBiometricOutRepairs,
} from "../repair-orphan-biometric-outs";
import {
  BIOMETRIC_DEVICE_LABEL,
  BIOMETRIC_FINGERPRINT,
} from "../zkteco-attlog";

describe("planOrphanBiometricOutRepairs", () => {
  it("plans Budiongan-style orphan OUT onto the open biometric day", () => {
    const repairs = planOrphanBiometricOutRepairs(
      [
        {
          id: "ev-out",
          time_clock_entry_id: "entry-23",
          punched_at: "2026-09-23T09:11:38.000Z",
          action: "clock_out",
        },
      ],
      [
        {
          id: "entry-23",
          clock_in_time: "2026-09-22T23:41:32.000Z",
          clock_out_time: null,
          clock_in_location: "Green Pasture",
          status: "clocked_in",
          hr_notes: null,
        },
      ]
    );

    assert.equal(repairs.length, 1);
    assert.equal(repairs[0].entryId, "entry-23");
    assert.equal(repairs[0].eventId, "ev-out");
    assert.deepEqual(repairs[0].update, {
      clock_out_time: "2026-09-23T09:11:38.000Z",
      clock_out_device: BIOMETRIC_DEVICE_LABEL,
      clock_out_fingerprint: BIOMETRIC_FINGERPRINT,
      clock_out_location: "Green Pasture",
      status: "clocked_out",
      hr_notes: ORPHAN_OUT_REPAIR_NOTE,
    });
  });

  it("skips entries that already have clock_out_time", () => {
    const repairs = planOrphanBiometricOutRepairs(
      [
        {
          id: "ev",
          time_clock_entry_id: "e1",
          punched_at: "2026-09-23T09:00:00.000Z",
          action: "clock_out",
        },
      ],
      [
        {
          id: "e1",
          clock_in_time: "2026-09-23T00:00:00.000Z",
          clock_out_time: "2026-09-23T09:00:00.000Z",
          clock_in_location: null,
          status: "auto_approved",
          hr_notes: null,
        },
      ]
    );
    assert.deepEqual(repairs, []);
  });

  it("skips OUT at or before clock-in", () => {
    const repairs = planOrphanBiometricOutRepairs(
      [
        {
          id: "ev",
          time_clock_entry_id: "e1",
          punched_at: "2026-09-23T00:00:00.000Z",
          action: "clock_out",
        },
      ],
      [
        {
          id: "e1",
          clock_in_time: "2026-09-23T00:00:00.000Z",
          clock_out_time: null,
          clock_in_location: null,
          status: "clocked_in",
          hr_notes: null,
        },
      ]
    );
    assert.deepEqual(repairs, []);
  });

  it("keeps earliest OUT when multiple orphan events hit one entry", () => {
    const repairs = planOrphanBiometricOutRepairs(
      [
        {
          id: "later",
          time_clock_entry_id: "e1",
          punched_at: "2026-09-23T10:00:00.000Z",
          action: "clock_out",
        },
        {
          id: "earlier",
          time_clock_entry_id: "e1",
          punched_at: "2026-09-23T09:00:00.000Z",
          action: "clock_out",
        },
      ],
      [
        {
          id: "e1",
          clock_in_time: "2026-09-23T00:00:00.000Z",
          clock_out_time: null,
          clock_in_location: null,
          status: "clocked_in",
          hr_notes: "note",
        },
      ]
    );
    assert.equal(repairs.length, 1);
    assert.equal(repairs[0].eventId, "earlier");
    assert.equal(repairs[0].update.clock_out_time, "2026-09-23T09:00:00.000Z");
    assert.match(repairs[0].update.hr_notes, /note/);
    assert.match(repairs[0].update.hr_notes, /Repaired:/);
  });

  it("ignores non clock_out actions", () => {
    assert.deepEqual(
      planOrphanBiometricOutRepairs(
        [
          {
            id: "ev",
            time_clock_entry_id: "e1",
            punched_at: "2026-09-23T09:00:00.000Z",
            action: "clock_in",
          },
        ],
        [
          {
            id: "e1",
            clock_in_time: "2026-09-23T00:00:00.000Z",
            clock_out_time: null,
            clock_in_location: null,
            status: "clocked_in",
            hr_notes: null,
          },
        ]
      ),
      []
    );
  });
});
