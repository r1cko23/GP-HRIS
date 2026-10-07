import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEventReceipts } from "../reconciliation";

test("classifies matched, missing, stale and unexpected receipts", () => {
  const result = reconcileEventReceipts({
    source: [
      { eventId: "event-1", eventVersion: 1 },
      { eventId: "event-2", eventVersion: 2 },
      { eventId: "event-3", eventVersion: 1 },
    ],
    receipts: [
      { eventId: "event-1", eventVersion: 1 },
      { eventId: "event-2", eventVersion: 1 },
      { eventId: "event-4", eventVersion: 1 },
    ],
  });

  assert.deepEqual(result.matchedEventIds, ["event-1"]);
  assert.deepEqual(result.missingEventIds, ["event-3"]);
  assert.deepEqual(result.staleEventIds, ["event-2"]);
  assert.deepEqual(result.unexpectedEventIds, ["event-4"]);
});

test("deduplicates receipt IDs and keeps the highest observed version", () => {
  const result = reconcileEventReceipts({
    source: [{ eventId: "event-1", eventVersion: 2 }],
    receipts: [
      { eventId: "event-1", eventVersion: 1 },
      { eventId: "event-1", eventVersion: 2 },
    ],
  });

  assert.deepEqual(result.matchedEventIds, ["event-1"]);
  assert.equal(result.scannedCount, 1);
});
