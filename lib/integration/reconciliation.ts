export type EventReceipt = {
  eventId: string;
  eventVersion: number;
};

export type ReconciliationResult = {
  scannedCount: number;
  matchedEventIds: string[];
  missingEventIds: string[];
  staleEventIds: string[];
  unexpectedEventIds: string[];
};

export function reconcileEventReceipts(input: {
  source: EventReceipt[];
  receipts: EventReceipt[];
}): ReconciliationResult {
  const sourceVersions = highestVersions(input.source);
  const receiptVersions = highestVersions(input.receipts);
  const matchedEventIds: string[] = [];
  const missingEventIds: string[] = [];
  const staleEventIds: string[] = [];

  for (const [eventId, sourceVersion] of sourceVersions) {
    const receiptVersion = receiptVersions.get(eventId);
    if (receiptVersion === undefined) missingEventIds.push(eventId);
    else if (receiptVersion < sourceVersion) staleEventIds.push(eventId);
    else matchedEventIds.push(eventId);
  }

  const unexpectedEventIds = [...receiptVersions.keys()].filter(
    (eventId) => !sourceVersions.has(eventId)
  );

  return {
    scannedCount: sourceVersions.size,
    matchedEventIds: matchedEventIds.sort(),
    missingEventIds: missingEventIds.sort(),
    staleEventIds: staleEventIds.sort(),
    unexpectedEventIds: unexpectedEventIds.sort(),
  };
}

function highestVersions(events: EventReceipt[]): Map<string, number> {
  const versions = new Map<string, number>();
  for (const event of events) {
    const eventId = event.eventId.trim();
    if (!eventId || !Number.isInteger(event.eventVersion)) continue;
    versions.set(
      eventId,
      Math.max(versions.get(eventId) ?? 0, event.eventVersion)
    );
  }
  return versions;
}
