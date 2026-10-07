# Integration event catalog

This catalog defines the durable integration contract among **GP-HRIS**, **CSM-GP**, and **GP-Client-Attendance-Payroll** (GP-Client). It does not require the apps to share a database or deploy together.

The domain split is:

- **GP-HRIS / Directory:** Person, Employment, approved Position/rate card, canonical Client/Branch IDs.
- **CSM-GP:** Client Demand and the Placement approval workflow for Deployed workers.
- **GP-Client:** client-specific time rules and Approved Work.
- **GP-HRIS Payroll:** Pay Ledger, statutory outputs, bank/remittance, and Deployed Bill Ledger.

Related decisions: [0018](../adr/0018-person-employment-placement.md), [0019](../adr/0019-client-demand-ownership.md), [0020](../adr/0020-workflow-outbox-inbox.md), [0021](../adr/0021-contextual-credentials.md), and [0022](../adr/0022-approved-work-pay-bill-ledgers.md).

## 1. Contract rules

### 1.1 Event envelope

Every durable event uses this JSON envelope. Domain data belongs in `data`; consumers must not infer it from transport headers.

```json
{
  "event_id": "018f6f5e-7d54-7a6d-9cc6-cc16c83f9ee2",
  "event_type": "gp.directory.person.updated.v1",
  "event_version": 1,
  "occurred_at": "2026-10-07T03:40:12.432Z",
  "recorded_at": "2026-10-07T03:40:12.917Z",
  "producer": "gp-hris",
  "subject": "person/2ae17cb4-4303-4c81-b7d7-23de172b1ff3",
  "organization_id": "5b51a6c1-1e78-4a48-b4da-92d8748f28b6",
  "client_id": "026831da-c2cf-4558-b13e-d21b5ab5c78d",
  "correlation_id": "7f14c65c-b60f-4143-8d55-cd6d8f24c310",
  "causation_id": "29416c08-81db-4ba1-b620-8b0cdd136bd5",
  "actor": {
    "type": "user",
    "id": "871f7a9a-24c4-4858-87ff-424197413caf"
  },
  "trace_id": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "data": {}
}
```

Required fields are `event_id`, `event_type`, `event_version`, `occurred_at`, `recorded_at`, `producer`, `subject`, `organization_id`, `correlation_id`, `causation_id`, and `data`.

- `event_id` is globally unique and immutable, preferably UUIDv7.
- `event_type` is namespaced, past tense, and ends in `.vN`.
- `event_version` repeats `N` as an integer so schema registries can validate without parsing the name.
- `subject` is the stable aggregate reference, not a display code.
- `organization_id` is always present. `client_id` is present when the fact is client-scoped.
- `correlation_id` follows one business journey, such as demand → placement → work → pay → bill.
- `causation_id` is the command ID or prior event ID that directly caused this event.
- `occurred_at` is business time; `recorded_at` is when the producer committed the event.
- `actor.type` is `user`, `service`, or `migration`; secrets and personal data are never included.
- `data` carries stable UUIDs and decision facts. It must not contain credentials or an entire 201 file.

### 1.2 Commands

Commands are authenticated HTTP requests to the owning app, not broadcast events. Every command carries:

```text
Authorization: Bearer <contextual service credential>
Idempotency-Key: <UUID>
X-Correlation-Id: <UUID>
traceparent: <W3C trace context, when available>
```

The request body includes `command_version`. The owner validates current state, commits the state change and outbox event atomically, then returns:

- `200` or `201` with the resource and emitted `event_id`;
- `202` with an operation ID if processing is asynchronous;
- the original successful response when the same idempotency key and body are replayed;
- `409 idempotency_conflict` when a key is reused with a different body;
- `409 invalid_state` for a stale lifecycle transition;
- `422` for a structurally valid command that violates domain rules.

### 1.3 Versioning and compatibility

1. Additive optional fields do not create a new major event version.
2. Removing, renaming, changing meaning/type, or making a field required creates `.v2` (or later).
3. A producer publishes old and new major versions in parallel until every registered consumer reports support for the new version and the rollback window closes.
4. Consumers ignore unknown fields, reject unknown major versions to their DLQ, and never silently reinterpret them.
5. IDs, amount currency, timestamps, hour units, and status meanings are semantic contracts. A semantic change requires a new major version even when the JSON shape is unchanged.
6. Event schemas and examples are versioned with the producing app. Deployment fails if a published type has no schema or compatibility check.

### 1.4 Delivery, idempotency, and ordering

Delivery is **at least once**. Exactly-once delivery is not promised.

- Producers insert domain state and an outbox row in one database transaction.
- Dispatchers may deliver duplicates or deliver later events before earlier events.
- Consumers insert `(consumer_name, event_id)` into an inbox before applying a projection, in the same transaction as that projection.
- Duplicate `event_id` is a successful no-op.
- Where order matters, the payload includes aggregate `revision`; consumers apply only the next revision or pause that subject for reconciliation.
- Business writes use domain idempotency keys in addition to event deduplication:
  - placement: `placement_id`;
  - approved work: `(work_period_id, directory_employee_id, position_id, revision)`;
  - pay line: `(pay_run_id, approved_work_line_id)`;
  - bill line: `(bill_run_id, approved_work_line_id)`.

### 1.5 Retries, DLQ, and replay

- Retry transient failures with exponential backoff and jitter: approximately 1 minute, 5 minutes, 30 minutes, 2 hours, then 12 hours.
- Authentication, authorization, schema, and invariant failures are not hammered. After one confirmation attempt they move to the DLQ.
- A message moves to the DLQ after 10 attempts or 24 hours, whichever comes first.
- DLQ records preserve the original envelope, failure class, attempts, first/last failure time, and consumer. They never store a plaintext credential.
- Replay uses the original `event_id`; replay is therefore safe through the inbox. Operators may create a new repair command, but must not manufacture a replacement event for an unchanged historical fact.
- Alerts fire on oldest-undelivered age, retry growth, DLQ count, and projection lag.

### 1.6 Reconciliation

Events accelerate projections; owner APIs remain authoritative. Each app runs reconciliation at least daily and on demand:

1. Compare owner high-water marks and aggregate revisions with local inbox/projection state.
2. Fetch missing or divergent resources from the owner API using stable UUIDs.
3. Repair the local projection through the same idempotent projector used by events.
4. Record a reconciliation run with counts for scanned, missing, repaired, unresolved, and stale.
5. Require a human decision for identity ambiguity, unapproved placement, unexplained hours, or posted-ledger differences.

Minimum cross-app controls:

- CSM Placement person/client/branch/position IDs exist in Directory.
- GP-Client period roster is a subset of effective approved Placements.
- Every Approved Work line resolves to one Person, Employment, Placement, Position, and period.
- Every posted Pay or Bill line traces to an immutable Approved Work line.
- Posted totals are compared, never silently rewritten.

## 2. Commands by owner

Commands describe intent. Their accepted result is one or more events in section 3.

| Owner | Command | Caller | Required context | Result |
|---|---|---|---|---|
| GP-HRIS | `CreatePerson.v1` | HR UI / migration | organization | Creates the one Directory Person |
| GP-HRIS | `UpdatePerson.v1` | HR UI | organization | Updates 201 attributes; no placement mutation |
| GP-HRIS | `OpenEmployment.v1` | HR UI | organization | Opens a sequential Employment/Tenure |
| GP-HRIS | `EndEmployment.v1` | HR UI / authorized CSM flow | organization | Ends Employment and prevents later regular work |
| GP-HRIS | `RehirePerson.v1` | HR UI | organization | Freezes prior Employment and opens another |
| GP-HRIS | `ApprovePositionRateCard.v1` | authorized AM | organization + client | Makes a Position eligible for Placement |
| CSM-GP | `OpenClientDemand.v1` | AS / ops | organization + client | Opens requested headcount by branch and position |
| CSM-GP | `ReviseClientDemand.v1` | AS / ops | organization + client | Creates a new demand revision |
| CSM-GP | `CancelClientDemand.v1` | AS / ops | organization + client | Closes unfilled demand without moving people |
| CSM-GP | `ProposePlacement.v1` | AS | organization + client | Selects an existing Person/Employment for demand |
| CSM-GP | `ApprovePlacement.v1` | AM / authorized approver | organization + client | Makes Placement effective and publishable |
| CSM-GP | `TransferPlacement.v1` | AM / authorized approver | source + destination client context | Ends prior Placement and approves a successor |
| CSM-GP | `EndPlacement.v1` | AM / authorized approver | organization + client | Ends site assignment, not necessarily Employment |
| CSM-GP | `PublishVerifiedRoster.v1` | AM / scheduler | organization + client | Publishes a revisioned roster snapshot |
| GP-Client | `OpenWorkPeriod.v1` | assigned monitor | organization + client | Opens a client/branch/date/pay-format period |
| GP-Client | `ValidateApprovedWork.v1` | HR/Audit | organization + client | Freezes revisioned premium-hour lines |
| GP-Client | `CorrectApprovedWork.v1` | HR/Audit | organization + client | Supersedes an unposted revision or creates adjustment work |
| GP-HRIS | `AcceptApprovedWork.v1` | GP-Client service | organization + client | Stores the immutable Approved Work projection |
| GP-HRIS | `BuildPayRun.v1` | Finance | organization + client | Builds draft Pay Ledger lines from Approved Work |
| GP-HRIS | `PostPayRun.v1` | Finance | organization + client | Posts immutable Pay Ledger lines |
| GP-HRIS | `BuildBillRun.v1` | Finance | organization + client | Builds draft Bill Ledger lines from Approved Work |
| GP-HRIS | `PostBillRun.v1` | Finance | organization + client | Posts immutable Bill Ledger lines |
| GP-HRIS | `CancelDraftBillRun.v1` | Finance | organization + client | Cancels only an unposted Bill run |

## 3. Events by producer

All event payloads include the IDs in the table plus the aggregate `revision`. Names and amounts shown to users are projections and may be included as snapshots, but UUIDs are the join keys.

### 3.1 GP-HRIS / Directory

| Event type | Trigger | Required `data` |
|---|---|---|
| `gp.directory.person.created.v1` | Person committed | `person_id`, `employee_code`, `revision` |
| `gp.directory.person.updated.v1` | 201 attributes changed | `person_id`, `changed_fields`, `revision` |
| `gp.directory.employment.opened.v1` | Hire or rehire Employment opened | `employment_id`, `person_id`, `started_on`, `revision` |
| `gp.directory.employment.ended.v1` | Employment ended | `employment_id`, `person_id`, `ended_on`, `reason_code`, `revision` |
| `gp.directory.position.approved.v1` | Rate card approved | `position_id`, `client_id`, `branch_id`, `effective_from`, `revision` |
| `gp.directory.position.retired.v1` | Rate card no longer selectable | `position_id`, `effective_to`, `revision` |

Person events deliberately exclude full government IDs, bank details, medical data, and attachments. An authorized consumer that truly needs a field re-fetches it from the Directory API.

### 3.2 CSM-GP

| Event type | Trigger | Required `data` |
|---|---|---|
| `gp.csm.client-demand.opened.v1` | Demand approved for staffing | `demand_id`, `client_id`, `branch_id`, `position_id`, `requested_headcount`, `effective_from`, `revision` |
| `gp.csm.client-demand.revised.v1` | Headcount/dates changed | `demand_id`, `requested_headcount`, `effective_from`, `effective_to`, `revision` |
| `gp.csm.client-demand.cancelled.v1` | Demand withdrawn | `demand_id`, `reason_code`, `revision` |
| `gp.csm.placement.proposed.v1` | AS nominates a person | `placement_id`, `demand_id`, `person_id`, `employment_id`, `position_id`, `proposed_start`, `revision` |
| `gp.csm.placement.approved.v1` | AM accepts Placement | `placement_id`, `demand_id`, `person_id`, `employment_id`, `client_id`, `branch_id`, `position_id`, `effective_from`, `revision` |
| `gp.csm.placement.ended.v1` | Placement stops | `placement_id`, `effective_to`, `reason_code`, `revision` |
| `gp.csm.verified-roster.published.v1` | AM Verified snapshot published | `roster_id`, `client_id`, `branch_id`, `cutoff_start`, `cutoff_end`, `placement_ids`, `revision` |

### 3.3 GP-Client

| Event type | Trigger | Required `data` |
|---|---|---|
| `gp.time.work-period.opened.v1` | Period created | `work_period_id`, `client_id`, `branch_id`, `period_start`, `period_end`, `pay_format`, `revision` |
| `gp.time.approved-work.recorded.v1` | Validated period committed | `approved_work_id`, `work_period_id`, `source_roster_id`, `line_count`, `totals`, `revision` |
| `gp.time.approved-work.corrected.v1` | Validated correction/adjustment committed | `approved_work_id`, `supersedes_approved_work_id`, `correction_kind`, `line_count`, `totals`, `revision` |

Each Approved Work line contains `approved_work_line_id`, `directory_employee_id` (`person_id`), `employment_id`, `placement_id`, `position_id`, premium-hour matrix, approved allowances, source timesheet revision, and approval timestamp. Raw punches may be linked for audit but are not the pay/bill contract.

### 3.4 GP-HRIS / payroll and billing

| Event type | Trigger | Required `data` |
|---|---|---|
| `gp.payroll.approved-work.accepted.v1` | Approved Work stored and validated | `approved_work_id`, `cutoff_period_id`, `source_event_id`, `revision` |
| `gp.payroll.pay-run.built.v1` | Draft Pay Ledger built | `pay_run_id`, `approved_work_ids`, `line_count`, `gross_total`, `net_total`, `currency`, `revision` |
| `gp.payroll.pay-run.posted.v1` | Pay Ledger posted | `pay_run_id`, `posted_at`, `line_count`, `gross_total`, `net_total`, `currency`, `revision` |
| `gp.payroll.adjustment-run.posted.v1` | Adjustment Pay Ledger posted | `pay_run_id`, `source_pay_run_id`, `approved_work_ids`, `net_total`, `currency`, `revision` |
| `gp.billing.bill-run.built.v1` | Draft Bill Ledger built | `bill_run_id`, `approved_work_ids`, `line_count`, `subtotal`, `currency`, `revision` |
| `gp.billing.bill-run.posted.v1` | Bill Ledger posted | `bill_run_id`, `posted_at`, `subtotal`, `vat`, `ewt`, `total_due`, `currency`, `revision` |
| `gp.billing.bill-run.cancelled.v1` | Draft Bill run cancelled | `bill_run_id`, `reason_code`, `revision` |

Events carry totals for routing and reconciliation, not enough data to regenerate a ledger. Financial reports read the owning ledger API or stored export.

## 4. End-to-end correlations

### Hire and place

`CreatePerson` → `person.created` → `OpenEmployment` → `employment.opened` → `ProposePlacement` → `placement.proposed` → `ApprovePlacement` → `placement.approved` → `verified-roster.published`

All messages use the correlation ID created when the staffing journey starts. A Placement may satisfy a `demand_id`; a Person and Employment do not.

### Regular cutoff

`verified-roster.published` → `OpenWorkPeriod` → `ValidateApprovedWork` → `approved-work.recorded` → `AcceptApprovedWork` → `approved-work.accepted` → `BuildPayRun` / `BuildBillRun` → independent `pay-run.posted` and `bill-run.posted`

The Pay and Bill branches share Approved Work lineage but neither posted ledger is the source of the other.

### Transfer

`TransferPlacement` atomically ends the source Placement and approves a successor. Both events share one correlation ID and causation ID. Hours already approved against the source Placement remain attached to it; later work uses the successor.

### Correction after posting

`CorrectApprovedWork` creates adjustment Approved Work referring to the original. GP-HRIS creates a separate Adjustment Pay run and, when contractually billable, a separate Bill adjustment. Existing posted ledgers are unchanged.

## 5. Ownership and privacy guardrails

- An event is a fact, not a request for another app to bypass its invariants.
- Consumers never write another app's tables directly.
- Events do not transfer ownership. Directory remains authoritative for Person/Employment; CSM for Demand/Placement workflow; GP-Client for Approved Work; GP-HRIS for Pay/Bill Ledgers.
- Keep payloads minimal under RA 10173. No credential, password, attachment, full bank account, medical record, or government-ID image belongs in an event.
- Logs may contain IDs, event types, revisions, and totals; redact personal values and authorization headers.
- GREENHRISMAIN does not publish or consume these runtime events. During migration it remains a read-only catalog and a separately controlled fallback.
