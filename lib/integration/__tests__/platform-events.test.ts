import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPlatformEvent,
  nextOutboxAttempt,
  receivePlatformEvent,
  validatePlatformEvent,
} from "../platform-events";

describe("platform event envelope", () => {
  it("creates a versioned event with stable correlation metadata", () => {
    const event = createPlatformEvent({
      eventId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      producer: "csm-gp",
      organizationId: "33333333-3333-4333-8333-333333333333",
      subject: "placement/placement-1",
      eventType: "gp.csm.placement.approved.v1",
      data: { employee_id: "employee-1" },
      occurredAt: "2026-10-07T04:00:00.000Z",
      recordedAt: "2026-10-07T04:00:01.000Z",
      actor: { type: "service", id: "csm-dispatcher" },
    });

    assert.equal(event.event_version, 1);
    assert.equal(event.correlation_id, "22222222-2222-4222-8222-222222222222");
    assert.equal(event.producer, "csm-gp");
    assert.equal(event.subject, "placement/placement-1");
    assert.deepEqual(event.data, { employee_id: "employee-1" });
  });

  it("deduplicates redelivery by source app and event id", () => {
    const first = receivePlatformEvent({
      producer: "csm-gp",
      eventId: "11111111-1111-4111-8111-111111111111",
      existing: [],
    });
    assert.deepEqual(first, { accepted: true });

    const duplicate = receivePlatformEvent({
      producer: "csm-gp",
      eventId: "11111111-1111-4111-8111-111111111111",
      existing: [
        {
          producer: "csm-gp",
          event_id: "11111111-1111-4111-8111-111111111111",
        },
      ],
    });
    assert.deepEqual(duplicate, { accepted: false, reason: "duplicate" });
  });

  it("backs off failures and dead-letters the final attempt", () => {
    const retry = nextOutboxAttempt({
      attempts: 2,
      maxAttempts: 4,
      now: new Date("2026-10-07T04:00:00.000Z"),
    });
    assert.equal(retry.status, "failed");
    assert.equal(retry.attempts, 3);
    assert.equal(retry.availableAt, "2026-10-07T04:04:00.000Z");

    const dead = nextOutboxAttempt({
      attempts: 3,
      maxAttempts: 4,
      now: new Date("2026-10-07T04:00:00.000Z"),
    });
    assert.equal(dead.status, "dead");
    assert.equal(dead.availableAt, null);
  });
});

it("validates a complete event envelope and rejects malformed identifiers", () => {
  const event = createPlatformEvent({
    eventId: "917beb71-f2e5-447e-9376-181fcaae363c",
    eventType: "gp.csm.placement.approved.v1",
    producer: "csm-gp",
    organizationId: "06eb9221-0880-48c9-b1b8-f8b15fef7b84",
    subject: "placement:123",
    correlationId: "b2465d30-3b09-4f40-8322-fc5c6e0f7356",
    actor: { type: "service", id: "csm-outbox" },
    data: { placement_id: "123" },
  });

  assert.equal(validatePlatformEvent(event).ok, true);
  assert.deepEqual(validatePlatformEvent({ ...event, event_id: "nope" }), {
    ok: false,
    error: "event_id must be a UUID",
  });
});
