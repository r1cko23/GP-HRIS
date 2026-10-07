export type PlatformApp = "gp-hris" | "csm-gp" | "gp-client";

export type PlatformEvent<TPayload extends Record<string, unknown>> = {
  event_id: string;
  event_type: string;
  event_version: number;
  occurred_at: string;
  recorded_at: string;
  producer: PlatformApp;
  subject: string;
  organization_id: string;
  client_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  actor: { type: "user" | "service" | "migration"; id: string };
  trace_id: string | null;
  data: TPayload;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePlatformEvent(
  value: unknown
):
  | { ok: true; event: PlatformEvent<Record<string, unknown>> }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "event envelope must be an object" };
  }
  const event = value as Record<string, unknown>;
  for (const field of ["event_id", "organization_id", "correlation_id"]) {
    if (typeof event[field] !== "string" || !UUID.test(event[field])) {
      return { ok: false, error: `${field} must be a UUID` };
    }
  }
  if (
    event.causation_id !== null &&
    event.causation_id !== undefined &&
    (typeof event.causation_id !== "string" || !UUID.test(event.causation_id))
  ) {
    return { ok: false, error: "causation_id must be a UUID or null" };
  }
  if (
    typeof event.event_type !== "string" ||
    !/^gp\.[a-z0-9-]+\.[a-z0-9.-]+\.v\d+$/.test(event.event_type)
  ) {
    return { ok: false, error: "event_type must be namespaced and versioned" };
  }
  if (
    !Number.isInteger(event.event_version) ||
    Number(event.event_version) < 1
  ) {
    return { ok: false, error: "event_version must be a positive integer" };
  }
  if (
    !["gp-hris", "csm-gp", "gp-client"].includes(String(event.producer)) ||
    typeof event.subject !== "string" ||
    !event.subject.trim() ||
    !event.data ||
    typeof event.data !== "object" ||
    Array.isArray(event.data)
  ) {
    return { ok: false, error: "event envelope fields are invalid" };
  }
  return {
    ok: true,
    event: event as PlatformEvent<Record<string, unknown>>,
  };
}

export function createPlatformEvent<
  TPayload extends Record<string, unknown>,
>(input: {
  eventId: string;
  eventType: string;
  producer: PlatformApp;
  organizationId: string;
  clientId?: string | null;
  subject: string;
  correlationId: string;
  causationId?: string | null;
  eventVersion?: number;
  occurredAt?: string;
  recordedAt?: string;
  actor: { type: "user" | "service" | "migration"; id: string };
  traceId?: string | null;
  data: TPayload;
}): PlatformEvent<TPayload> {
  if (!input.eventType.trim()) throw new Error("eventType is required");
  if (!input.subject.trim()) throw new Error("subject is required");
  if (!input.organizationId.trim()) {
    throw new Error("organizationId is required");
  }

  const eventVersion = input.eventVersion ?? 1;
  if (!Number.isInteger(eventVersion) || eventVersion < 1) {
    throw new Error("eventVersion must be a positive integer");
  }

  return {
    event_id: input.eventId,
    event_type: input.eventType.trim(),
    event_version: eventVersion,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    recorded_at: input.recordedAt ?? new Date().toISOString(),
    producer: input.producer,
    subject: input.subject.trim(),
    organization_id: input.organizationId,
    client_id: input.clientId ?? null,
    correlation_id: input.correlationId,
    causation_id: input.causationId ?? null,
    actor: input.actor,
    trace_id: input.traceId ?? null,
    data: input.data,
  };
}

export function receivePlatformEvent(input: {
  producer: PlatformApp;
  eventId: string;
  existing: Array<{ producer: string; event_id: string }>;
}): { accepted: true } | { accepted: false; reason: "duplicate" } {
  const duplicate = input.existing.some(
    (row) =>
      row.producer === input.producer && row.event_id === input.eventId
  );
  return duplicate
    ? { accepted: false, reason: "duplicate" }
    : { accepted: true };
}

export function nextOutboxAttempt(input: {
  attempts: number;
  maxAttempts: number;
  now?: Date;
}): {
  attempts: number;
  status: "failed" | "dead";
  availableAt: string | null;
} {
  const attempts = input.attempts + 1;
  if (attempts >= input.maxAttempts) {
    return { attempts, status: "dead", availableAt: null };
  }

  // 1m, 2m, 4m, 8m… capped at one hour.
  const delayMinutes = Math.min(2 ** (attempts - 1), 60);
  const available = new Date((input.now ?? new Date()).getTime());
  available.setUTCMinutes(available.getUTCMinutes() + delayMinutes);
  return {
    attempts,
    status: "failed",
    availableAt: available.toISOString(),
  };
}
