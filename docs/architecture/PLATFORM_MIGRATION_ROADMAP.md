# Platform migration roadmap

This is the strangler plan for moving the live three-app process from shared keys, best-effort webhooks, duplicate rosters, and GREENHRISMAIN fallback to the contracts in the [Integration event catalog](./INTEGRATION_EVENT_CATALOG.md).

It is a migration, not a rewrite. **GP-HRIS**, **CSM-GP**, and **GP-Client** remain separately deployable. Each phase is enabled by Organization, Client, and capability so one Client can advance or roll back without moving the rest.

## 1. Guardrails

1. Directory remains Person and Employment source of truth.
2. CSM owns Client Demand and Placement workflow for Deployed operations.
3. GP-Client owns client-specific time rules and Approved Work.
4. GP-HRIS owns Pay and Bill Ledgers.
5. No runtime INSERT/EXEC to GREENHRISMAIN. Existing controlled JSON import remains a fallback only for Clients not cut over.
6. No mass Bundy enrollment of Deployed workers.
7. Posted Pay and Bill Ledgers are immutable.
8. New consumers are fed before old paths are removed. Destructive schema cleanup is a later, separately approved phase.

## 2. Measures used at every gate

Metrics are sliced by `organization_id`, `client_id`, event type, producer, and consumer.

| Measure | Definition | Gate |
|---|---|---|
| Outbox age | Oldest unpublished committed event | p95 under 60 seconds; max under 5 minutes |
| Delivery success | Delivered without DLQ / attempted | at least 99.9% over 7 days |
| Inbox lag | Recorded time to consumer commit | p95 under 2 minutes; max under 15 minutes |
| Duplicate safety | Duplicate deliveries that changed the projection twice | exactly 0 |
| DLQ rate | DLQ events / delivered events | under 0.1%; no unresolved item older than 1 business day |
| Reconciliation drift | Owner aggregates differing from projections | under 0.1%; no unexplained Person, Placement, or money drift |
| Identity coverage | Active rows with canonical Directory IDs | 100% for a pilot Client |
| Lineage coverage | Work/pay/bill lines with all upstream IDs | 100% before posting |
| Financial variance | New ledger total minus signed control total | zero unexplained variance; explained differences signed |
| Operational completion | Cutoff completed without manual DB repair | 100% of exit cutoffs |

Service-level metrics prove transport health; business reconciliation proves correctness. Neither substitutes for the other.

## 3. Phase 0 — baseline and freeze contracts

### Scope

- Inventory current HTTP calls, `employee.*` webhooks, GP-Client ingest, JSON fallback, and manual repair steps.
- Assign stable Directory IDs to the pilot Client, Branches, Positions, and people.
- Record baseline counts and timing for AM Verified, GP-Client Validated, cutoff ingest, register, bank/remittance, and billing outputs.
- Publish envelope schemas and capability names without changing runtime behavior.
- Select one low-risk Deployed pilot Client with clean recent cutoffs and named business owners.

### Exit

- 100% of pilot active people resolve to one `directory_employee_id`.
- Every pilot CSM and GP-Client Client/Branch/Position row has its Directory ID.
- Baseline includes two prior cutoffs and all current manual exceptions.
- Product, Finance, HR, and Ops sign the ownership map and rollback owner list.

### Rollback trigger and action

There is no production traffic change. If identity mapping is ambiguous or baseline totals cannot be explained, stop the pilot and return records to the HR review queue. Do not auto-merge people or advance the Client.

## 4. Phase 1 — transactional event rails in shadow

### Scope

- Add transactional outbox dispatch to each producer and transactional inbox handling to each consumer.
- Emit versioned events in shadow mode while existing HTTP/webhook behavior remains authoritative.
- Add retries, DLQ operations, replay, high-water marks, and daily reconciliation.
- Introduce contextual service credentials in audit-only mode alongside the existing shared key.
- Correlate existing synchronous calls with commands and resulting events.

### Exit

- Seven consecutive days meet outbox, delivery, inbox, duplicate, and DLQ gates.
- A forced duplicate, reordered pair, transient outage, invalid schema, and credential rotation are exercised in staging.
- Replaying the full pilot event stream creates the same shadow projection as owner API reconciliation.
- No event payload contains prohibited personal or credential data.

### Rollback trigger and action

Trigger on lost events, duplicate side effects, unbounded lag, or reconciliation drift above 0.1%. Disable dispatch/consumption flags, keep outbox rows for diagnosis, and continue existing synchronous paths. Because shadow consumers do not own decisions, rollback does not alter live state.

## 5. Phase 2 — Person, Employment, Demand, and Placement

### Scope

- Materialize the Person/Employment/Placement split from [ADR 0018](../adr/0018-person-employment-placement.md).
- CSM creates and revises Client Demand, then proposes/approves Placements for existing Directory people and Employments.
- Directory publishes Person/Employment and approved Position events.
- GP-Client consumes approved Placement/Verified roster projections; names become display snapshots only.
- Dual-write current CSM AM Verified transitions into the new Placement model while the old Verified view remains readable.

### Exit

- Pilot identity and placement coverage are 100%.
- For two roster publication cycles, AM Verified equals effective approved Placements by stable ID; every difference has a recorded reason.
- GP-Client cannot add a person without an effective Placement and approved Position.
- Hire, rehire, transfer, end-placement, and end-employment lifecycle tests pass without creating a second Person.
- No production workflow needs a manual cross-database row edit.

### Rollback trigger and action

Trigger if roster drift exceeds 0.1%, a valid worker is blocked, an ended Placement remains eligible, or any transition creates a duplicate Person. Stop new Placement commands for the Client and return reads to the old Verified projection. Preserve new records as audit history; reverse only through compensating end/cancel commands, never SQL deletion.

## 6. Phase 3 — Approved Work becomes the time contract

### Scope

- GP-Client validation commits immutable, revisioned Approved Work and its outbox event.
- GP-HRIS inbox accepts Approved Work idempotently into the cutoff-hours projection.
- Run existing ingest and event-driven ingest in parallel; compare line IDs, people, positions, hours, allowances, and totals.
- Corrections before posting supersede an Approved Work revision. Corrections after posting create adjustment Approved Work.
- Keep `tbl_timekeep` JSON available but do not make it the primary pilot path.

### Exit

- Two consecutive pilot cutoffs have 100% lineage from each accepted work line to Person, Employment, Placement, Position, and approval.
- Event-driven and control ingest have zero unexplained person/hour/allowance differences.
- Duplicate delivery and retry produce no duplicate cutoff row.
- Reconciliation can repair a deliberately skipped event from the GP-Client owner API.
- HR/Audit and Payroll sign the Approved Work totals.

### Rollback trigger and action

Trigger on missing/duplicate lines, invalid Placement acceptance, unresolved hour variance, or inbox lag above 15 minutes near payroll close. Freeze Build/Post, switch the pilot to the existing authenticated ingest or controlled JSON fallback, reconcile by source revision, and resume only after signed totals. Never patch posted pay.

## 7. Phase 4 — Pay Ledger cutover per Client

### Scope

- Build Pay Ledger solely from accepted Approved Work plus Directory pay-rate/statutory snapshots and authorized deductions.
- Run GP-HRIS and the existing production payroll path in parallel for the pilot.
- Produce payslips, remittance, statutory files, and bank output from GP-HRIS.
- Treat GREENHRISMAIN comparisons as diagnostic controls, not an amount oracle.
- Use separate Adjustment Pay runs after posting.

### Exit

- Two consecutive pilot cutoffs are built, reviewed, posted, and exported entirely in GP-HRIS.
- 100% of Pay lines trace to Approved Work and snapshotted calculation inputs.
- No unexplained gross, deduction, net, bank, or remittance variance remains.
- Zero post/exports require manual database repair.
- Finance and the named business approvers provide written sign-off.

### Rollback trigger and action

Before Post, trigger on unexplained financial variance, missing statutory inputs, failed bank/remittance generation, or lineage below 100%; cancel the draft and use the established fallback for that Client. After Post, do **not** roll back or rebuild the posted run: issue Approved Work and Pay Adjustment runs. A Client does not leave fallback until the two-cutoff exit is signed.

## 8. Phase 5 — independent Bill Ledger cutover

### Scope

- Build Bill Ledger from the same immutable Approved Work, independent billing-rate snapshots, employer bill-backs, fees, VAT, and EWT.
- Preserve the operational rule that Finance releases billing only after payroll controls for the cutoff are satisfied; do not use Pay lines as billing input.
- Parallel-run existing billing output for the pilot and compare SOA/debit memo controls.
- Support separately posted billing adjustments linked to adjustment Approved Work.

### Exit

- Two consecutive pilot Bill runs have 100% Approved Work lineage.
- Billable hours agree with Approved Work; all pay-versus-bill differences have a reason code and contractual basis.
- SOA subtotal, fee, VAT, EWT, and total due have zero unexplained variance.
- Rebuilding a draft from identical snapshots is deterministic.
- Finance signs the billing output and collection handoff.

### Rollback trigger and action

Before Bill Post, cancel the draft and use the prior billing path if rates, tax wrap, or contractual mappings differ. After Bill Post, preserve it and issue a credit/debit adjustment; never cancel a posted Bill Ledger or mutate Pay. Pay remains live even if billing rolls back.

## 9. Phase 6 — contextual credentials enforce least privilege

### Scope

- Replace shared `x-directory-api-key` access with short-lived contextual credentials scoped to app, environment, Organization, allowed Clients, and capabilities.
- Start with dual acceptance, then require contextual credentials for one command family at a time.
- Keep user ABAC grants separate from service credentials.
- Automate rotation, expiry alerts, revocation, and audit reporting.

### Exit

- 100% of pilot machine calls use contextual credentials.
- Cross-Organization, out-of-scope Client, wrong-audience, expired, and revoked token tests are denied.
- Rotation causes no missed event or failed cutoff.
- Shared-key use is zero for 30 days and its secret is revoked.

### Rollback trigger and action

Trigger on valid-call denial above 0.1%, authorization bypass, or rotation outage. Re-enable the previous credential only through a time-boxed break-glass record limited to the affected app and Client, then investigate. Never broaden a token globally to clear an outage.

## 10. Phase 7 — retire legacy paths

### Scope

- Advance additional Clients through phases 0–6 independently.
- Stop `tbl_timekeep` JSON production and GREENHRISMAIN live payroll/billing for signed-off Clients.
- Remove best-effort `employee.*` webhooks after all registered consumers use catalog events.
- Make old roster/person copies read-only, then archive them under retention policy.
- Remove shared service keys only after credential migration.

### Exit

- Every migrated Client has two signed Pay cutoffs and two signed Bill cutoffs where billing applies.
- Thirty days show no calls to retired endpoints, no shared-key use, and no legacy import for migrated Clients.
- Reconciliation and restore drills pass from owner APIs plus event/outbox history.
- Runbooks, on-call ownership, retention, and audit evidence are accepted.

### Rollback trigger and action

Do not drop legacy data or code during the rollback window. If a retired dependency reappears, restore its read-only adapter or fallback export for only the affected Client. Reopening GREENHRISMAIN as an application write target requires a separate incident decision; this roadmap does not authorize it.

## 11. Rollout controls

Use explicit flags, not deployment order:

- `events.emit.<type>`
- `events.consume.<consumer>.<type>`
- `commands.require_contextual_credentials.<capability>`
- `client.<id>.placements_authoritative`
- `client.<id>.approved_work_authoritative`
- `client.<id>.pay_ledger_authoritative`
- `client.<id>.bill_ledger_authoritative`

Every flag change records actor, time, Client, prior/new value, correlation ID, and approved rollback window. An authority flag changes only after its phase exit is signed.

## 12. Migration completion

The platform migration is complete when:

- every live Person has one Directory identity and sequential Employments;
- Deployed work eligibility comes from effective approved Placements satisfying CSM Demand;
- GP-Client publishes immutable Approved Work;
- GP-HRIS independently posts traceable Pay and Bill Ledgers;
- all integration writes use contextual credentials and transactional outbox/inbox delivery;
- reconciliation has no unexplained drift;
- GREENHRISMAIN is catalog/history only for migrated Clients.
