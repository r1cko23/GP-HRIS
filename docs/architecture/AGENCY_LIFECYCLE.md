# Agency lifecycle — candidate to redeploy

This document defines the operational lifecycle across **GP-HRIS**, **CSM-GP**, and
**GP-Client-Attendance-Payroll**. It is a behavior contract for screens, commands,
states, audit events, and cross-product recovery.

It does not move ownership:

- **GP-HRIS** owns the candidate, Directory person, 201, Tenure, Engagement, rates,
  final pay, payroll register, and Deployed client billing.
- **CSM-GP** owns Deployed staffing requests, AS Draft, AM approval, and AM Verified.
- **GP-Client** owns Deployed Periods, client-specific timesheet rules, and Validated
  cutoff hours.
- **GREENHRISMAIN** remains a read-only catalog and temporary dual-run destination.

Organic staff skip CSM and GP-Client. Deployed staff use all three products. One
human has one `directory_employee_id`; rehire and redeploy never create another 201.

## 1. Actors and grants

| Actor | Primary product | May do | May not do |
|---|---|---|---|
| Recruiter | GP-HRIS | Capture candidates, screen, offer, reject, withdraw, convert accepted candidate | Activate Engagement, approve rates, publish Deployed headcount |
| HR encoder | GP-HRIS | Resolve duplicate, complete 201 packet, statutory IDs, bank details, onboarding | Type a second person for a returnee |
| HR approver | GP-HRIS | Activate Organic Engagement; complete release/final pay; rehire | Publish Deployed headcount |
| Position owner | GP-HRIS | Draft Client position and rate card | Use an unapproved position for hire, transfer, or rehire |
| Hotel / Non-Hotel rate approver | GP-HRIS | Approve or reject the applicable position rate card | Edit a worker’s hours |
| Account Supervisor (AS) | CSM | Add an existing Directory person to Draft; propose transfer or resign | Create a 201, change payroll rates, self-approve |
| Account Manager (AM) / Admin | CSM | Approve, return, or reject Draft changes; publish AM Verified | Approve a row without a Directory ID and approved position |
| Assigned monitor | CSM | Open GP-Client timekeeping for a site | Add an unverified worker to a Period |
| Timekeeping encoder | GP-Client | Add AM Verified people who worked; encode hours | Type a new identity or calculate net pay |
| Payroll reviewer | GP-Client | Return or payroll-approve a submitted Period | Change Directory identity or rates |
| HR / time auditor | GP-Client | Return or Validate hours | Edit a posted GP-HRIS register |
| Payroll / Finance | GP-HRIS | Build, review, post, export, send payslips, process Deployed billing | Alter a posted register |
| Worker | GP-HRIS portal | Complete assigned packet items, view requests and payslips; clock when enrolled | Activate themselves or edit approved identity/rate fields |
| Client contact | Client portal | View assigned requests, submitted worker summaries, coverage/status, approved documents | Open private 201, statutory, bank, payroll, or internal notes |

Authorization is by **Page** and **Function** Grants plus organization/client
attributes. Labels above describe actors, not hard-coded roles.

## 2. Records and identifiers

These are distinct records. UI and APIs must not collapse them into a generic
“employee status.”

| Record | Purpose | Identity / uniqueness |
|---|---|---|
| Candidate | Pre-employment prospect and recruiting activity | Candidate UUID; dedupe keys include normalized name, birth date, mobile, email, and government IDs when present |
| Staffing request | Client demand for a position/site/date/count | Request UUID in CSM; linked `directory_client_id`, branch, approved position |
| Directory person | One permanent 201 per human | `directory_employee_id`; stable employee code after first hire |
| Tenure | One hire-to-exit employment episode | Tenure UUID; immutable after close |
| Engagement | Current Tenure projected as employer/client/branch/position/status | Same Directory person; one current engagement |
| CSM Draft row | Proposed Deployed assignment/movement | Stores `directory_employee_id`; not published headcount |
| AM Verified row | Published Deployed assignment | Stores the same `directory_employee_id` |
| GP-Client Period row | One worked assignment in one cutoff | Period + Directory employee + Directory position |
| Cutoff assignment | Payroll grain for hours and rate | Cutoff + Directory employee + position |
| Payroll register line | Calculated pay for one cutoff assignment | Immutable after register Post |

Candidate data is not a second 201. Conversion links the candidate to an existing
Directory person or creates exactly one Directory person in `for_verification`.
Candidate attachments move by explicit document classification; an opaque candidate
file must not be copied wholesale into the 201.

## 3. State vocabularies

### 3.1 Candidate

| State | Meaning | Allowed exits |
|---|---|---|
| `new` | Captured, not triaged | `screening`, `withdrawn`, `rejected`, `cancelled` |
| `screening` | Identity, eligibility, and source are being checked | `qualified`, `returned`, `withdrawn`, `rejected`, `cancelled` |
| `returned` | Recruiter must correct missing/invalid information | `screening`, `withdrawn`, `cancelled` |
| `qualified` | Eligible for a specific approved position or talent pool | `offered`, `screening`, `withdrawn`, `rejected`, `cancelled` |
| `offered` | Dated offer issued | `accepted`, `declined`, `rescinded`, `cancelled` |
| `accepted` | Offer accepted; ready for conversion/onboarding | `converted`, `withdrawn`, `rescinded` |
| `converted` | Linked to the one Directory person and onboarding packet | Terminal for this application |
| `rejected` | Agency declines the application, with reason | Terminal; a future application is a new candidate application linked to the same person if known |
| `declined` | Candidate declines the offer | Terminal |
| `withdrawn` | Candidate ends the process | Terminal |
| `rescinded` | Agency withdraws an issued/accepted offer | Terminal |
| `cancelled` | Requisition or process is closed for a non-candidate reason | Terminal |

`reject`, `decline`, `withdraw`, `rescind`, and `cancel` are separate commands and
audit events. Each requires a reason; rescind after acceptance also requires an
effective date and approver. Terminal records remain searchable and are never
silently deleted.

### 3.2 Staffing request

| State | Meaning |
|---|---|
| `draft` | Client demand being composed |
| `submitted` | Awaiting internal/client approval |
| `returned` | Requester must correct scope, rate, dates, or documents |
| `approved` | May receive qualified candidates against an approved Directory position |
| `partially_filled` | At least one slot filled; open quantity remains |
| `filled` | Requested quantity reached |
| `cancelled` | No further placement; existing Tenures are unaffected |

A request cancellation never auto-resigns already deployed workers. Reducing quantity
below current placements requires explicit worker movement decisions.

### 3.3 Onboarding packet

Packet state is derived, not manually selected:

- `not_started`: no required item completed.
- `in_progress`: at least one required item completed.
- `blocked`: one or more blocking items were returned, expired, or failed verification.
- `ready`: all blocking items are verified; non-blocking items may remain.
- `complete`: every required item is verified or explicitly waived by an authorized
  user with reason.

Each item has `missing`, `submitted`, `verified`, `returned`, `waived`, or `expired`.
The item stores owner, due date, verifier, timestamps, return reason, and document
version. Replacing a returned document creates a new version; it does not erase the
review history.

### 3.4 Employment and deployment

Directory Engagement status uses the existing vocabulary:

`for_verification` → `active` ↔ `float` / deployment `barred` →
`for_release` → `inactive`

Rules:

- First conversion creates the Directory person as `for_verification`.
- Organic HR activates after the blocking packet and approved position are ready.
- Deployed activation/site assignment is published by CSM AM Approve.
- `for_release` is excluded from regular cutoffs and proceeds to final pay.
- `inactive` or **final-pay barred** returns through **Rehire**, opening a new Tenure.
- `float`, **deployment barred**, or `for_verification` returns through **Activate**
  on the current Tenure.
- Transfer and redeploy keep the employee code and Directory person.

CSM change state is:

`draft` → `pending_approval` → `approved` (AM Verified)

From `pending_approval`, AM may `return` to Draft or `reject` to a terminal proposal.
Cancelling a Draft removes only the proposal. Rescinding an approved future-dated
assignment creates a compensating CSM movement and restores the last published
assignment; it must not delete history.

GP-Client Period validation state remains:

`draft` → `submitted` → `payroll_approved` → `approved` (label: **Validated**)

Reviewers may return `submitted` or `payroll_approved` to `draft` with a reason.
Before HRIS Post, a correction reopens and re-validates the Period. After Post,
correction uses an Adjustment Period and its own Adjustment register.

## 4. Entry and matching rules

Before a candidate may become a 201:

1. Search Directory by employee code/alias, exact government ID, normalized name +
   birth date, mobile, and email.
2. Show match confidence and evidence; never auto-merge on name alone.
3. If a credible match exists, HR chooses **Link existing person**. The action records
   candidate ID, Directory ID, operator, evidence, and timestamp.
4. If the match is an inactive or final-pay-barred person, conversion routes to
   **Rehire**, not Add employee.
5. If the match is float, deployment-barred, or for-verification, conversion routes
   to **Activate / continue onboarding** on the current Tenure.
6. Only **No confirmed match** permits creation of a new Directory person.
7. A uniqueness conflict after submit returns the conversion to HR’s duplicate queue;
   it never retries by creating another person.

Employee code is issued once from first hire month. Legacy codes remain aliases.

## 5. Happy paths

### 5.1 Organic first hire

1. Recruiter moves candidate through `new → screening → qualified → offered →
   accepted`.
2. HR runs person matching and creates or links the Directory person.
3. A new person is created `for_verification`; accepted candidate becomes `converted`.
4. HR and worker complete the onboarding packet. HR resolves identity, statutory,
   bank, emergency contact, employment terms, approved position, and hire date.
5. HR approver selects **Activate**. The command verifies blocking packet items and
   approved position, then opens the Tenure and sets the Organic Engagement active.
6. If the Organic Client is `bundy_enabled`, GP-HRIS best-effort creates/links the
   `public.employees` enrollment.
7. The worker appears in People immediately. Clock/portal availability appears only
   after enrollment succeeds.
8. Organic hours follow Clock + approved OT/leave → Aggregate → Audit → Approve →
   Build → Post → report pack.

### 5.2 Deployed first placement

1. An approved CSM staffing request references a Directory Client, Branch, and
   approved Position.
2. Recruiter completes candidate acceptance and HR conversion/matching in GP-HRIS.
3. HR completes the 201 packet; the person remains `for_verification` until the
   deployment is approved.
4. AS searches Directory and adds the existing person to CSM Draft. Typed names are
   forbidden.
5. AM reviews the person, site, position, effective date, packet readiness, and
   request capacity.
6. AM Approve atomically publishes AM Verified locally and calls the Directory
   Engagement command with an idempotency key.
7. On success, Directory sets the same person active at the approved
   Client/Branch/Position. CSM marks the synchronization complete.
8. Assigned monitor opens the site Period. GP-Client permits the encoder to add only
   AM Verified people who worked.
9. GP-Client moves hours through Submit → Payroll approve → Validate. Validation
   creates/reuses the HRIS cutoff and ingests hours.
10. GP-HRIS builds and posts the register, exports the report pack, sends eligible
    payslips, and makes Deployed billing available after Post.

### 5.3 Redeploy an active/float worker

Use this path for a worker moving to another Deployed site without ending employment.

1. AS creates a transfer/redeploy Draft against an approved destination position and
   effective date. The source assignment remains published until approval.
2. AM may return or reject the proposal without changing Directory or AM Verified.
3. On approve, CSM closes the source published assignment at the effective boundary,
   publishes the destination, and writes one Directory transfer movement.
4. Directory keeps the same person, employee code, and Tenure; current Engagement
   becomes the destination assignment.
5. If the transfer falls inside a cutoff, each GP-Client Period records the actual
   site and position worked. HRIS may hold two Cutoff assignments for the same person
   when positions/rates differ.
6. Future Period pickers stop offering the source assignment and offer the
   destination assignment.

### 5.4 Rehire and redeploy an inactive worker

1. Recruiter/HR finds the existing 201 and prior closed Tenure.
2. New candidate activity may be linked for recruiting history, but no second 201 or
   employee code is created.
3. HR selects **Rehire**, enters new hire date, Client, Branch, approved Position,
   rates, and packet delta requirements.
4. Directory freezes the old Tenure and opens a new Tenure on the same person.
5. Organic rehire may become active after HR approval. Deployed rehire proceeds
   through CSM Draft and AM Approve before the site assignment is published.
6. Prior final-pay outcome remains on the old Tenure. New pay, hours, and final pay
   belong to the new Tenure.

## 6. Return, reject, cancel, rescind, and release

| Event | Record affected | Required effect | Must not happen |
|---|---|---|---|
| Return screening | Candidate | Move to `returned`; assign corrections and due date | Destroy reviewer notes |
| Reject candidate | Candidate | Terminal `rejected`, reason/category, notification status | Set a linked employee inactive |
| Candidate withdraws | Candidate | Terminal `withdrawn`, actor and reason | Mark as agency rejection |
| Cancel requisition | Staffing request | Stop new placements; preserve placed workers | Bulk-resign workers |
| Rescind offer before conversion | Candidate | Terminal `rescinded`; revoke unsigned links | Create/delete a 201 |
| Rescind after conversion but before activation | Candidate + onboarding | Preserve 201 as `for_verification`; close/void pending packet by reason | Delete Directory person/code |
| Return CSM proposal | Draft proposal | Editable Draft with field-level reason | Change published assignment |
| Reject CSM proposal | Draft proposal | Close proposal; source assignment remains | Mutate Directory |
| Rescind future approved deployment | Published assignment | Compensating movement restores prior published state | Delete audit/movement rows |
| Worker no-show before effective start | Engagement/Tenure | Authorized HR/AM cancels future movement; if Tenure already opened, close it with explicit no-show outcome | Backdate/delete silently |
| Start final pay | Engagement | `for_release` + resign date; remove from regular cutoff eligibility | Post final pay automatically |
| Cancel release | Engagement | **Activate** same Tenure with movement and reason, if final pay is not completed | Rehire or create person |
| Complete final pay | Tenure/Engagement | Close Tenure; set inactive; freeze episode | Rewrite posted register |
| Correct after payroll Post | Period/cutoff | Adjustment Period → Validated → Adjustment register | Edit or re-ingest posted regular |

Notifications are side effects, not state transitions. A failed email/SMS does not
undo an otherwise successful transition; it creates a retryable delivery task.

## 7. Partial-failure and retry contract

Cross-product workflows must expose three outcomes:

- **Complete** — local commit and required remote command succeeded.
- **Pending sync** — authoritative local decision committed, remote command did not
  confirm; automatic/manual retry is available.
- **Blocked** — precondition failed before authoritative state changed.

Every cross-product command carries:

- stable idempotency key;
- source product and source record ID;
- actor/user ID and organization ID;
- expected prior state/version;
- effective date;
- correlation ID;
- payload checksum.

The receiving product returns the authoritative record ID, resulting version/state,
and whether the request was newly applied or replayed.

### 7.1 Required failure handling

| Failure point | Durable truth | UI and recovery |
|---|---|---|
| Candidate conversion times out before response | Directory decides whether idempotency key created/linked a person | Show `Checking conversion`; query by idempotency key before allowing retry |
| Candidate converted, attachment copy fails | Person and candidate link remain valid | Packet shows failed items; retry only failed copies; do not roll back person |
| Organic activation succeeds, Bundy enrollment fails | Engagement is Active; enrollment is absent | Show `Active · Clock setup failed`; retry enrollment; never create a second `public.employees` row |
| CSM AM decision fails validation before local publish | Existing AM Verified and Directory stay unchanged | Keep proposal pending/returned with exact failed precondition |
| CSM publishes locally, Directory update times out | CSM row is `approved · pending sync`; it is not eligible for GP-Client until sync confirms | Retry same command; reconciliation compares versions; Admin may return to prior published assignment through a compensating event |
| Directory updates but CSM loses response | Directory movement is authoritative and idempotent | Retry receives same result; CSM marks sync complete without a second movement |
| CSM sync complete, GP-Client roster refresh fails | AM Verified and Directory are correct | GP-Client shows stale-sync warning; refresh/re-pull; no typed fallback |
| GP-Client Validate succeeds, HRIS ingest fails | Period remains Validated with `ingest_failed` delivery status | Show skipped/error rows and Retry ingest; payroll cutoff is not ready |
| Ingest partially maps workers | Accepted hours are durable; skipped workers are explicit | Period shows accepted/skipped counts; fix Directory links and retry replacement ingest before Post |
| Re-ingest targets posted regular cutoff | Posted register remains immutable | HRIS returns 409; GP-Client creates/reuses Adjustment Period |
| Register posts, payslip email fails | Posted pay remains complete | Delivery queue lists failed/skipped recipients; resend without rebuilding |
| Register posts, bank/remittance export fails | Posted pay remains complete | Regenerate deterministic export; do not unpost |
| Deployed payroll posts, billing build fails | Worker pay remains posted | Billing tab shows failed build and retry; never reverse payroll to repair billing |

No screen may offer “try again” if it would issue a fresh create without the original
idempotency key.

### 7.2 Reconciliation queues

Each product provides a filtered operational queue:

- GP-HRIS: candidate conversions pending, duplicate candidates, failed document
  transfers, failed Bundy enrollments, Needs review, failed payslip/export deliveries.
- CSM: approved changes pending Directory sync, rejected syncs, future movements,
  request capacity conflicts.
- GP-Client: AM Verified refresh failures, unmapped Period people, failed/partial
  ingests, Validated Periods without an HRIS cutoff ID.

Queue rows show record, client/site, age, last error, attempts, next retry, correlation
ID, and one safe next action. Bulk retry is allowed only for idempotent deliveries;
human data conflicts require row-by-row resolution.

## 8. Effective dates and cutoff boundaries

- Store business dates in the Client/Organization timezone; lock semantics use
  `Asia/Manila`.
- A movement has requested, approved, and effective timestamps.
- Future-approved movement does not alter the current Engagement before its effective
  date.
- Cutoff eligibility is evaluated against Engagement/Tenure date overlap, then the
  product-specific roster gate.
- Organic cutoff roster: active Engagement overlap.
- Deployed cutoff roster: people on the Validated Period, each AM Verified and Active
  in Directory.
- AM Verified without worked hours remains published but is not auto-added to a
  Period or payroll.
- A mid-cutoff transfer may produce multiple Cutoff assignments. Remittance remains
  one person.

## 9. Audit and timeline events

Every state-changing command appends an event. Minimum fields:

`event_id`, `entity_type`, `entity_id`, `event_type`, `from_state`, `to_state`,
`occurred_at`, `effective_at`, `actor_user_id`, `actor_product`, `organization_id`,
`client_id`, `reason_code`, `reason_text`, `correlation_id`, `idempotency_key`,
`source_record_id`, and changed-field summary.

The person timeline includes links, not duplicated prose, for:

- candidate created/screened/offered/accepted/converted;
- duplicate resolution;
- packet item submitted/returned/verified/waived;
- position/rate approval used;
- Tenure opened/closed;
- activate, transfer, float, bar, release, inactive, rehire;
- CSM Draft/return/reject/approve and sync state;
- GP-Client Period add/validation/ingest;
- payroll build/post/Adjustment and payslip delivery.

Private recruiting, conduct, medical, government-ID, and bank details are redacted by
Grant. Client-facing timelines receive only an allowlisted event projection.

## 10. Acceptance scenarios

Implementation is not complete until these pass at product seams:

1. New Organic candidate converts once, completes packet, activates, and receives
   Clock enrollment; retry after timeout creates no duplicate.
2. New Deployed candidate cannot enter CSM Draft until linked to Directory and cannot
   enter AM Verified with an unapproved position.
3. AM return/reject leaves the existing Directory Engagement unchanged.
4. CSM local approval plus Directory timeout is visibly pending and cannot seed
   GP-Client until reconciliation succeeds.
5. Validated GP-Client Period with one unmapped person reports accepted/skipped counts;
   fixing the link and retrying produces one replacement hour set.
6. Cancelling a staffing request leaves already deployed workers active.
7. Offer rescind after conversion preserves the 201 and audit history.
8. Float/deployment-barred return uses Activate; inactive/final-pay-barred return uses
   Rehire with the same employee code.
9. Mid-cutoff redeploy records the correct site/position assignments without a second
   person.
10. A posted regular cutoff rejects re-ingest and the correction posts through an
    Adjustment register.
11. Failed payslip delivery, export, or Deployed billing does not reverse posted pay.
12. Organic flow contains no CSM/GP-Client dependency; Deployed flow never writes
    punches into GP-HRIS Clock.

## 11. Non-negotiable invariants

- One human, one Directory person, one stable employee code.
- A candidate is not headcount; CSM Draft is not published headcount; AM Verified is
  not a timesheet; a timesheet is not a payroll register.
- New hire and rehire require an approved destination Position.
- Deployed site/status changes are published by CSM approval; Organic stays in People.
- Siblings persist Directory UUIDs and call GP-HRIS HTTP contracts.
- Payroll consumes cutoff hours, never raw Deployed punches.
- Posted registers and closed Tenures are immutable.
- Organic has no CSM roster and no client-billing twin.
- Deployed rollout remains one Client at a time; no mass Bundy enrollment.
