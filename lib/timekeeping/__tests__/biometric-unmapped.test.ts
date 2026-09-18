import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNMAPPED_SKIP_REASON,
  aggregateUnmappedPins,
  filterAndPageUnmapped,
  type PunchEventHint,
} from "../biometric-unmapped";

describe("aggregateUnmappedPins", () => {
  it("groups skipped unmapped punches by device + PIN", () => {
    const events: PunchEventHint[] = [
      {
        device_id: "dev-a",
        device_user_id: "1001",
        punched_at: "2026-09-18T00:05:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
      {
        device_id: "dev-a",
        device_user_id: "1001",
        punched_at: "2026-09-18T09:10:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
      {
        device_id: "dev-a",
        device_user_id: "42",
        punched_at: "2026-09-18T01:00:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
    ];

    const rows = aggregateUnmappedPins(events, new Set());
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      deviceId: "dev-a",
      deviceUserId: "1001",
      punchCount: 2,
      lastPunchedAt: "2026-09-18T09:10:00.000Z",
    });
    assert.equal(rows[1].deviceUserId, "42");
    assert.equal(rows[1].punchCount, 1);
  });

  it("excludes PINs that already have a map", () => {
    const events: PunchEventHint[] = [
      {
        device_id: "dev-a",
        device_user_id: "1001",
        punched_at: "2026-09-18T00:05:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
      {
        device_id: "dev-a",
        device_user_id: "42",
        punched_at: "2026-09-18T01:00:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
    ];
    const mapped = new Set(["dev-a::1001"]);
    const rows = aggregateUnmappedPins(events, mapped);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deviceUserId, "42");
  });

  it("ignores non-unmapped skip reasons and empty PINs", () => {
    const events: PunchEventHint[] = [
      {
        device_id: "dev-a",
        device_user_id: "9",
        punched_at: "2026-09-18T00:00:00.000Z",
        skip_reason: "Employee inactive",
      },
      {
        device_id: "dev-a",
        device_user_id: "",
        punched_at: "2026-09-18T00:00:00.000Z",
        skip_reason: UNMAPPED_SKIP_REASON,
      },
    ];
    assert.deepEqual(aggregateUnmappedPins(events, new Set()), []);
  });

  it("zero events yields empty list", () => {
    assert.deepEqual(aggregateUnmappedPins([], new Set()), []);
  });
});

describe("filterAndPageUnmapped", () => {
  const rows = [
    {
      deviceId: "d",
      deviceUserId: "1001",
      punchCount: 3,
      lastPunchedAt: "2026-09-18T09:00:00.000Z",
    },
    {
      deviceId: "d",
      deviceUserId: "42",
      punchCount: 1,
      lastPunchedAt: "2026-09-18T08:00:00.000Z",
    },
  ];

  it("filters by PIN or display name", () => {
    const withNames = [
      {
        deviceId: "d",
        deviceUserId: "1001",
        punchCount: 3,
        lastPunchedAt: "2026-09-18T09:00:00.000Z",
        displayName: "Juan Dela Cruz",
      },
      {
        deviceId: "d",
        deviceUserId: "42",
        punchCount: 1,
        lastPunchedAt: "2026-09-18T08:00:00.000Z",
        displayName: "Maria Santos",
      },
    ];
    const byPin = filterAndPageUnmapped(withNames, {
      q: "42",
      limit: 50,
      offset: 0,
    });
    assert.equal(byPin.count, 1);
    assert.equal(byPin.data[0].deviceUserId, "42");

    const byName = filterAndPageUnmapped(withNames, {
      q: "juan",
      limit: 50,
      offset: 0,
    });
    assert.equal(byName.count, 1);
    assert.equal(byName.data[0].deviceUserId, "1001");
  });

  it("filters by q and pages", () => {
    const page = filterAndPageUnmapped(rows, { q: "42", limit: 50, offset: 0 });
    assert.equal(page.count, 1);
    assert.equal(page.data[0].deviceUserId, "42");
  });

  it("returns empty page when offset past end", () => {
    const page = filterAndPageUnmapped(rows, { q: "", limit: 1, offset: 5 });
    assert.equal(page.count, 2);
    assert.deepEqual(page.data, []);
  });
});
