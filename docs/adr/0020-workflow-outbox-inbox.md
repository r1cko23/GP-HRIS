# Cross-app workflows use transactional outbox and inbox

## Status

Accepted — 2026-10-07. Replaces best-effort webhooks as the target integration mechanism; existing webhooks remain compatibility paths during migration.

## Context

The three apps have separate databases and deploy independently. Current synchronous HTTP calls and optional Directory webhooks can lose a notification after a local commit, deliver duplicates on retry, or leave one app updated while another is unavailable. Payroll and staffing workflows need auditable facts, safe replay, and reconciliation; a distributed database transaction is neither available nor desirable.

Exactly-once network delivery cannot be guaranteed. Making every app share a database or message broker would also blur ownership and create a larger failure domain.

## Decision

1. Every integration-producing transaction writes domain state and an **outbox** event atomically in the producer database.
2. A dispatcher delivers committed outbox events **at least once**. It tracks attempts and publication state but does not mutate the event envelope.
3. Every consumer writes `(consumer_name, event_id)` to an **inbox** in the same transaction as its local projection or side effect. A duplicate event is a successful no-op.
4. Commands are authenticated point-to-point requests to the owning app. Each command uses an idempotency key and correlation ID. Accepted commands atomically emit result events.
5. Events use the envelope, versioning, retry, DLQ, privacy, ordering, and reconciliation rules in the [Integration event catalog](../architecture/INTEGRATION_EVENT_CATALOG.md).
6. Per-aggregate revisions detect gaps and stale updates. Consumers do not rely on global ordering.
7. Transient failures retry with bounded exponential backoff. Poison messages enter a DLQ with operator-visible reason and can be replayed with the original `event_id`.
8. Owner APIs remain authoritative. Scheduled and on-demand reconciliation compares owner revisions/high-water marks with consumer projections and repairs through the same idempotent projector.
9. No consumer writes another app's database, and no event handler silently invents a missing Person, Placement, Approved Work record, or financial line.

## Consequences

- A producer can commit while a consumer is down; delivery resumes later.
- Duplicate and replayed events are expected and testable rather than exceptional.
- Operational storage, dispatch workers, DLQ tooling, metrics, retention, and runbooks are required in all three apps.
- Business completion is eventually consistent across apps. UI must distinguish local acceptance, downstream processing, and failure.
- Cross-app workflows use correlation/causation IDs instead of distributed transactions.
- Existing best-effort `employee.*` webhooks and direct ingest calls can run in parallel until the strangler exit gates are met.
