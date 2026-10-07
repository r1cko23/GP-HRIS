# UX information architecture — three-product employment process

This document is the implementation contract for navigation, page hierarchy, shared
patterns, records, queues, and portals across:

1. **GP-HRIS** — People, Time, Payroll, Benefits, Reports, Admin, worker self-service.
2. **CSM-GP** — Deployed staffing requests, AS Draft, AM approval, AM Verified.
3. **GP-Client-Attendance-Payroll** — site Periods and client-rule timesheets.

The products remain separate hosts and sessions. Consistency means the same entity
names, IDs, status language, shell behavior, and deep-link conventions—not one
merged app.

Behavioral source of truth: [AGENCY_LIFECYCLE.md](./AGENCY_LIFECYCLE.md). Product
ownership and seams: [Architecture.md](./Architecture.md).

## 1. IA principles

1. **Navigate by work, not database table.** Primary navigation uses product nouns
   and user tasks.
2. **One label per concept.** Use Candidate, Directory person, Engagement, Tenure,
   AM Verified, Period, Cutoff hours, and Payroll register as defined in `CONTEXT.md`.
3. **Lists lead to records.** Search/filter in an index; decisions and history live
   on an entity record.
4. **State is visible before action.** Headers show current status, ownership, scope,
   effective date, and sync condition.
5. **Queues contain work.** Counts link to filtered lists; decorative KPI cards do
   not substitute for a task inbox.
6. **Cross-product links preserve context.** Links include canonical Directory IDs
   and return URLs when safe; never depend on names as identity.
7. **No dead-end handoffs.** If the next action belongs to another product, state
   who must act, where, and provide a deep link when the user has access.
8. **Progressive disclosure.** The default record view shows the decision surface;
   sensitive detail and historical payloads sit behind sections and Grants.

## 2. Shared application shell

All three internal products use the same shell anatomy.

### 2.1 Desktop

| Region | Content | Rules |
|---|---|---|
| Product rail | Product logo/name, primary destinations, collapse control | 240px expanded; 72px compact; selected destination has text + shape, not color alone |
| Top bar | Organization switcher, context crumb, universal search, task inbox, help, user menu | Sticky; search is the widest control; no duplicated page title |
| Page header | Breadcrumbs, title, identity/status metadata, primary action | Sticky only on long record/edit pages; primary action remains visible |
| Main | List, record, form, or operational workspace | 12-column grid; 24–48px margins; maximum readable text width 72ch |
| Side panel | Quick create, filters on medium screens, contextual details | Dismissible; never sole location for required information |

The Organization switcher appears only where the signed-in user has access to more
than one Organization. In GP-HRIS it switches Organic/Deployed and resets Client,
Branch, Position, and pagination. CSM and GP-Client are Deployed-only and instead
show assigned Client/site scope.

### 2.2 Mobile

- Rail becomes a drawer; top-level destinations appear in a bottom sheet/menu, not
  an overflowing horizontal tab row.
- Top bar retains product mark, page title, search trigger, inbox, and user menu.
- Record actions use one visible primary action plus an **Actions** menu.
- Filters open in a full-height sheet with **Apply** and **Clear**. Applied filters
  remain visible as removable chips.
- Data tables use a purpose-built card/list presentation. Do not force a desktop
  table into horizontal scrolling unless column comparison is the task.
- Sticky bottom actions must not cover content and must honor safe-area insets.

### 2.3 Visual foundations

- Source Sans 3.
- Semantic tokens only (`bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `primary`, `success`, `destructive`).
- 4px spacing base; page gutters 16–24px mobile and 24–48px desktop.
- GP-HRIS uses Phosphor icons; CSM/GP-Client use Lucide. Default icon is 20px,
  navigation 24px, minimum interactive target 44×44px.
- Motion explains state/relationship, stays at or under 300ms for interaction, and
  respects `prefers-reduced-motion`.
- Every control has default, hover, active, disabled, busy, and keyboard-focus
  states.

## 3. Persona homepages

The logo and **Home** route resolve to a homepage selected from the user’s Grants.
Users with multiple working personas choose a saved default; they can switch from
the user menu. Persona controls only homepage composition, never authorization.

### 3.1 Homepage composition

Every internal homepage has, in order:

1. **Resume work** — up to five recently opened records, stored per product/user.
2. **My tasks** — assigned and claimable tasks due now; same dataset as Inbox.
3. **Exceptions** — failed syncs, returned work, expiring documents, lock warnings.
4. **Operational status** — small, linked counts for the current scope.
5. **Shortcuts** — at most four frequent actions allowed by Grants.

No homepage fetches an unbounded activity feed. Counts use the same server-side
filters as the destination list.

### 3.2 Required persona variants

| Persona | Default product/route | First tasks |
|---|---|---|
| Recruiter | GP-HRIS `/home?persona=recruiter` | New/returned candidates, offers awaiting response, accepted candidates awaiting conversion |
| HR encoder/approver | GP-HRIS `/home?persona=hr` | For verification, packet returns, possible duplicates, Needs review, releases |
| Payroll/Finance | GP-HRIS `/home?persona=payroll` | Cutoffs ready to build/post, failed exports/delivery, adjustments, billing after Post |
| Time/leave approver | GP-HRIS `/home?persona=time` | Leave/OT/FTL approvals, Organic cutoff audit, enrollment failures |
| AS | CSM `/home?persona=as` | Staffing requests, returned Draft changes, open slots, approaching locks |
| AM | CSM `/home?persona=am` | Approval queue, rate/identity blockers, pending Directory sync |
| Assigned monitor | CSM `/home?persona=monitor` | Sites ready to open, pending Draft warnings, active Period links |
| Timekeeping encoder | GP-Client `/home?persona=encoder` | Open Periods, returned timesheets, missing AM Verified links |
| Payroll/HR reviewer | GP-Client `/home?persona=reviewer` | Submitted/payroll-approved Periods, failed ingest, adjustments |

## 4. Task inbox

Each product exposes `/inbox`; the bell opens a preview of the first ten tasks.
Inbox is work state, not a notification archive.

### 4.1 Task model

Minimum fields:

`task_id`, `task_type`, `entity_type`, `entity_id`, `title`, `organization_id`,
`client_id`, `assignee_user_id`, `assignee_group`, `priority`, `state`, `due_at`,
`created_at`, `updated_at`, `source_product`, `source_record_id`, `deep_link`,
`correlation_id`.

Task states: `open`, `claimed`, `snoozed`, `completed`, `cancelled`.
Completing the underlying business action completes the task. Dismissing a
notification does not.

### 4.2 Inbox UI

- Tabs: **Mine**, **Unassigned**, **Following**, **Completed**.
- Search: title, person name/code, Client/site, source reference.
- Filters: task type, priority, due state, Client/site, assignee, created date.
- Sort: priority then due date by default.
- Row content: task, entity, scope, age/due date, assignee, status, one contextual
  action shown on hover/focus.
- Bulk actions: assign, snooze, mark followed. Business approval/rejection remains
  row-by-row unless its command explicitly supports batch validation and audit.
- Deep-link open retains inbox query in `returnTo`.

Task creation is deterministic by `(task_type, entity_id, business_version)`, so a
retry does not duplicate work.

## 5. Universal search

Search is available from the top bar and `Cmd/Ctrl+K`. Search operates only within
the current product’s authorized index; it is not a cross-database browser query.

### 5.1 Search contract

- Debounce after 200–300ms; minimum two characters except exact employee code.
- Group results by entity; maximum five per group in the command palette.
- A final **View all results** opens `/search?q=...`.
- Server applies Organization, Client assignment, Page, Function, and field-level
  visibility before ranking.
- Rank exact employee/code/reference matches first, prefix second, then token/fuzzy
  name matches.
- Recent searches and entities are per user. Do not store sensitive result text in
  browser storage.
- Keyboard: arrows move, Enter opens, Escape closes, group headings are skipped.

### 5.2 Product indexes

| Product | Searchable entities | Result subtitle |
|---|---|---|
| GP-HRIS | Candidates, Directory people, Clients, branches, positions, cutoffs, registers, payslips | Employee code or reference · Client/site · status |
| CSM | Staffing requests, Clients/sites, Draft/Verified people, movements | Request/reference · site · workflow state |
| GP-Client | Clients/sites, Periods, Period people | Cutoff dates · validation state · ingest status |

Search result URLs carry UUIDs. A name search may return same-name people as distinct
results with employee code, birth-year only when granted, and current Client/site.

## 6. Entity record pattern

### 6.1 Record header

All record pages use:

1. Breadcrumb: index → parent scope → record.
2. Identity line: display name/reference and stable business ID.
3. Metadata line: Organization, Client/site, owner, effective/cutoff dates.
4. Status badges: business status first; sync/delivery status second.
5. Primary action: one next valid action.
6. **Actions** menu: less frequent valid transitions, print/export, copy link.
7. Alert strip: blocking issue with owner and resolution link.
8. Local tabs.

Actions are derived from state + Grants + attributes. Hiding an unauthorized action
does not replace server enforcement. Disabled actions explain the failed
precondition and link to the repair surface.

### 6.2 Record tabs

Use only tabs that represent stable sections:

- **Overview** — decision summary and next action.
- **Checklist** — packet/readiness requirements.
- **Activity** — canonical timeline.
- **Documents** — versioned files and verification.
- Domain tabs such as Engagement, Hours, Register, Downloads, Billing.

Do not use tabs as wizard steps or hide validation errors on another tab without an
error count.

### 6.3 Timeline

Timeline events are server-paginated and filterable by event family, actor/product,
and date. Each entry shows:

- event label and resulting state;
- effective time and recorded time when different;
- actor and source product;
- changed-field summary;
- reason;
- correlation/deep link for cross-product events.

Private details are rendered from an allowlist for the viewer. Raw payloads and
government IDs never appear in the default timeline.

## 7. Short wizards and packet checklists

### 7.1 Wizard rules

Use a wizard only for a command that needs ordered, interdependent input. Maximum
four steps:

1. **Scope** — person/request/client and effective date.
2. **Assignment** — Client, branch, approved position, terms.
3. **Requirements** — blocking checklist and exceptions.
4. **Review** — exact resulting state, side effects, and submit.

Simple edits remain one form. Each step:

- validates before Next;
- preserves a server draft;
- has a visible step name, not only a number;
- permits Back without data loss;
- warns before abandoning unsaved data;
- places errors beside fields and in a focusable summary;
- submits once with an idempotency key.

Never use a wizard for review/approval. Review pages show submitted data and
differences in one scan, with Approve, Return, and Reject actions.

### 7.2 Required wizards

| Product | Command | Steps |
|---|---|---|
| GP-HRIS | Convert accepted candidate | Match person → Employment scope → Packet requirements → Review |
| GP-HRIS | Transfer/Rehire | Person/Tenure → Destination → Effective terms → Review |
| GP-HRIS | Create cutoff | Client/sites → Dates/pay format → Policy/readiness → Review |
| CSM | Create staffing request | Site/position → Quantity/dates → Requirements → Review |
| CSM | Draft add/transfer/resign | Directory person → Change/effective date → Readiness → Review |
| GP-Client | Open Period | Site/dates → Pay format/rules → Source/readiness → Review |

### 7.3 Packet checklist

A checklist groups requirements by:

- identity;
- employment and approved position;
- statutory;
- bank/payment;
- client/site;
- health/safety only when legally required and separately granted;
- worker acknowledgements.

Each row shows requirement, applicability, owner, state, due/expiry, latest version,
return reason, and next action. Filters: blocking/all, owner, state, expiring.

Readiness summary uses explicit counts: “8 of 10 blocking items verified; 2 returned.”
“90% complete” alone is not sufficient. Waive requires a Function Grant, reason,
expiry where applicable, and audit event.

## 8. Worker portal

Canonical GP-HRIS route: `/employee-portal`.

Primary mobile-first navigation:

- **Home** `/employee-portal`
- **Time** `/employee-portal/time`
- **Requests** `/employee-portal/requests`
- **Pay** `/employee-portal/pay`
- **Profile** `/employee-portal/profile`

Home shows current clock state when enrolled, next schedule, request decisions,
packet tasks, and latest payslip—not HR operational queues.

Rules:

- Worker may submit assigned packet items but cannot verify them.
- Personal-data edits are proposed changes when the field requires HR verification.
- Pay lists posted payslips only; missing email does not hide portal access.
- Time is present only when Bundy enrollment exists and the Client permits it.
- A non-enrolled Deployed worker sees no inert clock button.
- Requests cover leave, OT, and failure-to-log with status, approver feedback, and
  withdrawal rules.
- Sensitive identifiers are masked by default; reveal requires reauthentication when
  supported.

## 9. Client portal

Client portal is a constrained CSM surface, not a second Directory or payroll app.
Canonical routes:

- `/portal` — coverage and items requiring client action.
- `/portal/requests` — staffing requests for the client’s assigned sites.
- `/portal/requests/[requestId]` — request status, quantity, candidate submissions.
- `/portal/workforce` — allowlisted AM Verified projection.
- `/portal/documents` — client-owned contracts/requirements and approved deliverables.

Client contacts may:

- create or comment on a staffing request when granted;
- approve/return client-owned request requirements;
- view worker display name, assignment, effective date, and approved client-visible
  credentials;
- see fulfillment counts and movement status.

They may not access full 201 files, candidate notes, government IDs, bank details,
internal conduct/medical notes, payroll register, payslips, or other Clients. Client
portal events use the same staffing request timeline with an allowlisted projection.

## 10. Exact IA — GP-HRIS

### 10.1 Primary navigation

Order and labels:

1. **Home** `/home`
2. **People** `/people`
3. **Benefits** `/benefits`
4. **Payroll** `/payroll`
5. **Time** `/time`
6. **Reports** `/reports`
7. **Admin** `/admin`
8. **Settings** `/settings`

Employee self-service `/employee-portal` uses its own shell. `/payroll-office` is
dual-run only and must not appear in primary navigation.

### 10.2 People

| Level | Label | Canonical route | Required children/content |
|---|---|---|---|
| Index | People | `/people` | Primary tabs **Clients**, **Employees**, **Candidates**; Organization switcher |
| Clients list | Clients | `/people?tab=clients` | Search, industry/status filters, pagination |
| Client record | Client | `/people/c/[clientId]` | Overview, Branches, Positions, Roster, Pay policy, Activity |
| New client | Add client | `/people/clients/new` | Client setup; no person creation |
| Employees list | Employees | `/people?tab=employees` | Queues: For verification, Needs review, Possible duplicate, For release; filters/search/pagination |
| Person record | 201 | `/people/c/[clientId]/[employeeId]` | Overview, Personal, Engagement, Compensation, Statutory, Bank, Documents, Lifecycle, Activity |
| Onboarding | Onboard | `/people/c/[clientId]/[employeeId]/onboard` | Packet checklist; not a separate person |
| New person | Add employee | `/people/employees/new` | Match-first conversion/manual exception; creates `for_verification` |
| Candidates list | Candidates | `/people/candidates` | Search, stage, owner, source, position, Client, date filters, pagination |
| Candidate record | Candidate | `/people/candidates/[candidateId]` | Overview, Application, Checklist, Documents, Activity |
| Candidate intake | Add candidate | `/people/candidates/new` | One-page intake; save as `new` |
| Convert | Convert candidate | `/people/candidates/[candidateId]/convert` | Four-step match-first wizard |

For backward compatibility, existing query URLs such as
`?tab=employees&queue=for_verification` remain valid and canonicalize to the same
list state.

### 10.3 Benefits

| Route | Label | Content |
|---|---|---|
| `/benefits` | Benefits home | Work queues and shortcuts |
| `/benefits/loans` | Loans | Employee loans, balances, schedules |
| `/benefits/allowances` | Allowances | Cutoff allowance records |
| `/benefits/deductions` | Deductions | Other cutoff deductions |
| `/benefits/statutory` | Statutory IDs | Missing/invalid SSS, PhilHealth, Pag-IBIG, TIN queue |

Each index is searchable, filterable, paginated, and scoped by Organization/Client.

### 10.4 Payroll

| Route | Label | Content |
|---|---|---|
| `/payroll` | Cutoffs | Search; status, Client, site, period-kind, date filters; pagination |
| `/payroll/new` | New cutoff | Short wizard |
| `/payroll/[id]` | Cutoff hub | Overview, Hours, Register, Downloads; Billing only for Deployed after Post; Activity |
| `/payroll/[id]?tab=hours` | Hours | Organic aggregate/audit/approve or Deployed ingest status |
| `/payroll/[id]?tab=register` | Register | Build/review/post; immutable after Post |
| `/payroll/[id]?tab=downloads` | Downloads | Report pack and delivery status |
| `/payroll/[id]?tab=billing` | Billing | Deployed only; build/process/export after payroll Post |

Adjustment cutoffs use the same record route and show source cutoff in the header.

### 10.5 Time

| Route | Label | Content |
|---|---|---|
| `/time` | Time home | Today’s exceptions and queues |
| `/time/clock` | Clock activity | Organic/enrolled people only |
| `/time/schedules` | Schedules | Assignment and coverage |
| `/time/leave` | Leave | Requests and approvals |
| `/time/overtime` | Overtime | Requests and approvals |
| `/time/failure-to-log` | Failure to log | Requests and approvals |
| `/time/cutoff-hours` | Cutoff hours | Cross-link to Payroll cutoff; no duplicate pay workflow |

Bundy enrollment remains Admin, not People or Time:
`/admin/enrollment`.

### 10.6 Reports, Admin, Settings

| Area | Routes |
|---|---|
| Reports | `/reports`, `/reports/workforce`, `/reports/payroll-register`, `/reports/bir`, `/reports/audit`, `/reports/parity` |
| Admin | `/admin`, `/admin/enrollment`, `/admin/imports`, `/admin/integrations`, `/admin/reconciliation` |
| Settings | `/settings`, `/settings/users`, `/settings/access`, `/settings/holidays`, `/settings/organization` |

Client pay calendar, statutory policy, branches, and positions stay on the Client
record in People—not Settings.

## 11. Exact IA — CSM-GP

### 11.1 Primary navigation

1. **Home** `/home`
2. **Requests** `/requests`
3. **Draft** `/draft`
4. **Approval** `/approval`
5. **Workforce** `/workforce`
6. **Clients** `/clients`
7. **Transmittal Audit** `/transmittal-audit`
8. **Reports** `/reports`
9. **Admin** `/admin`

### 11.2 Routes and records

| Route | Label | Contract |
|---|---|---|
| `/requests` | Staffing requests | Search; status, Client/site, position, owner, date filters; pagination |
| `/requests/new` | New request | Four-step request wizard |
| `/requests/[requestId]` | Request record | Overview, Requirements, Submissions, Placements, Activity |
| `/draft` | AS Draft | Proposed add/edit/transfer/resign; current filter in URL |
| `/draft/[changeId]` | Draft change | Existing Directory person, proposed diff, readiness, Activity |
| `/approval` | Approval | Pending AM decisions; filters/search/pagination |
| `/approval/[changeId]` | Review change | One-scan diff; Approve, Return, Reject |
| `/workforce` | AM Verified | Published headcount, not DTR; search/filter/pagination |
| `/workforce/[directoryEmployeeId]` | Assignment record | Allowlisted person header, current site/position, movements, sync state |
| `/clients` | Clients | Assigned sites, owners, lock state, active Period link |
| `/clients/[clientId]` | Client record | Overview, Sites, Requests, Workforce, Timekeeping, Activity |
| `/clients/[clientId]/sites/[siteId]` | Site record | Coverage, Verified roster, pending Draft, Open timekeeping |
| `/transmittal-audit` | Transmittal Audit | Import/compare against Verified; never mutates Verified |
| `/reconciliation` | Directory sync | Pending/failed sync queue for Admin/AM |

On the 2nd and 17th Asia/Manila lock days, Draft mutation actions are disabled with
the lock reason. **Open timekeeping** and 201 alert remain available.

**Open timekeeping** is a command on a site record, not a primary navigation item.
It confirms dates/pay format and deep-links to the created/reused GP-Client Period.

## 12. Exact IA — GP-Client-Attendance-Payroll

The product label presented to users is **Timekeeping**. It must not present itself
as the payroll system even if the repository/legacy name contains “Payroll.”

### 12.1 Primary navigation

1. **Home** `/home`
2. **Periods** `/periods`
3. **Clients** `/clients`
4. **Rules** `/rules`
5. **Exports** `/exports`
6. **Admin** `/admin`

### 12.2 Routes and records

| Route | Label | Contract |
|---|---|---|
| `/periods` | Periods | Search; state, Client/site, cutoff date, ingest state, adjustment filters; pagination |
| `/periods/[periodId]` | Period record | Overview, People, Timesheet, Review, Delivery, Activity |
| `/periods/[periodId]?tab=people` | People | Add from AM Verified only; no typed identity for linked sites |
| `/periods/[periodId]?tab=timesheet` | Timesheet | Client-rule encoding and validation |
| `/periods/[periodId]?tab=review` | Review | Submit/payroll approve/HR Validate or Return |
| `/periods/[periodId]?tab=delivery` | Delivery | HRIS cutoff ID, accepted/skipped rows, retry ingest, dual-run JSON |
| `/periods/[periodId]/adjustment/new` | New adjustment | Source posted cutoff, nearest payout, changed hours |
| `/clients` | Clients | Linked/unlinked status, site, current rules, recent Period |
| `/clients/[clientId]` | Client record | Overview, Sites, Rules, Pay format, Periods, Directory link, Activity |
| `/rules` | Rules | Searchable/filterable Client rule sets; no payroll formulas |
| `/exports` | Exports | Dual-run `tbl_timekeep` JSON history and status; no payslips/remittance |
| `/admin/directory-links` | Directory links | Unlinked Clients/sites/people and reconciliation |
| `/admin/integrations` | Integrations | Directory/ingest health without exposing service keys |

The Period state label **Validated** maps to API state `approved`. Delivery status is
separate: `not_sent`, `sending`, `sent`, `partial`, `failed`, `blocked_posted`.

## 13. Cross-product links and handoffs

| From | To | Link behavior |
|---|---|---|
| CSM Draft missing person | GP-HRIS candidate/person intake | Opens People search first, then intake; carries Client/site/position as non-authoritative context |
| CSM assignment | GP-HRIS 201 | Uses `directory_employee_id`; subject to People Grants |
| CSM site | GP-Client Period | Uses local Period ID returned by Open timekeeping |
| GP-Client person | CSM Verified assignment | Uses Directory employee + site |
| GP-Client Delivery | GP-HRIS cutoff | Uses `directory_cutoff_period_id` |
| GP-HRIS Deployed cutoff | GP-Client Period | Shows source Period ID and link |
| GP-HRIS person timeline | CSM/GP-Client source event | Opens source only when viewer has product access |

If a user lacks destination access, render source product, reference, and responsible
team without a broken link. Never place service credentials or sensitive record data
in query strings.

## 14. List standard

Every operational list implements:

- server-side `q`, meaningful filters, sort, `limit`, and `offset`/cursor;
- total count and “Showing X–Y of Z”;
- default page size 25 or 50, maximum API limit 200;
- URL-persisted search, filters, sort, and page;
- debounced search with context-specific autosuggestions;
- reset to first page when search/filter/sort changes;
- loading skeleton, inline retryable error, empty-on-file, and no-filter-results states;
- selectable rows only when a valid bulk action exists;
- one row action revealed on hover and keyboard focus, with overflow for the rest;
- sticky header only when it improves column tracking;
- exported data honors active filters and reports whether it exports page or all
  filtered results.

Column alignment:

- names/descriptions left;
- numeric counts, hours, money right with tabular numerals;
- statuses, dates, codes, and actions centered unless long-form content requires left.

Minimum filters by list:

| List family | Required filters |
|---|---|
| Candidates | stage, owner, position, Client, source, created date |
| People/roster | status/queue, Client, branch, position |
| Requests/Draft/Approval | state, Client/site, change type, owner, effective date |
| AM Verified | Client/site, position, active/effective state |
| Periods | validation state, delivery state, Client/site, cutoff dates, period kind |
| Cutoffs/registers | status, Organization, Client/site, dates, regular/adjustment |
| Tasks | state, assignee, priority, due state, task type |
| Timeline | event family, product/actor, date range |

Provably bounded enum pickers may omit pagination. Entity selectors use remote
search/autosuggest and must not preload a full 29k-person roster.

## 15. Responsive and accessibility contract

### 15.1 Breakpoints and density

- `<640px`: single-column, mobile record/list variants, full-screen sheets.
- `640–1023px`: two-column where useful; rail collapsed; filters in sheet.
- `≥1024px`: full rail and desktop tables.
- `≥1440px`: content may widen, but forms keep readable line length.
- Minimum text is 13px for operational UI and 15px for body copy; 11px is reserved
  for nonessential compact labels and never carries required instructions.

### 15.2 Accessibility

- Meet WCAG 2.2 AA for contrast, focus, keyboard operation, labels, errors, and
  reflow.
- One `h1` per page; headings descend without skipped structural levels.
- Landmarks: header, nav, main, complementary where applicable.
- Every input has a persistent label; placeholder is an example, not the label.
- Error summary receives focus after failed submit and links to invalid controls.
- Status never relies on color; badge includes text and optionally icon.
- Tables use captions or an accessible name, scoped headers, and text equivalents for
  icon actions.
- Modals trap focus, restore it on close, and are not used for multi-page records.
- Toasts announce transient outcomes; durable failures also remain inline/in Inbox.
- Loading and live status use restrained `aria-live`; do not announce every keystroke.
- Touch target minimum 44×44px. Keyboard focus is visible and not clipped.
- Dates show unambiguous formats; stored value/timezone is available where material.
- Money includes currency; hours include unit. Do not encode negative values by color
  alone.
- Reduced motion removes nonessential movement without suppressing state change.

## 16. Loading, empty, error, and sync states

Every page defines:

| State | Required treatment |
|---|---|
| First load | Shape-matched skeleton; preserve header and filters |
| Background refresh | Keep current data, show subtle updating state |
| Empty on file | Explain what belongs here and permitted create action |
| No filtered results | Preserve filters, offer Clear filters |
| Authorization denied | Name required Page/Function generically; no leaked data |
| Validation error | Field error + summary; preserve values |
| Remote dependency down | Preserve local truth; show source product, last successful sync, retry |
| Partial success | Exact succeeded/failed counts and row-level repair path |
| Conflict/stale version | Show changed record and require review; do not overwrite |
| Offline/browser failure | Do not claim success without server confirmation |

Optimistic UI is permitted for reversible preferences, follows, and task claims. It
is not permitted for Approve, Activate, Rehire, Validate, Post, or billing Process.

## 17. Copy and status language

- Button labels are commands: **Convert candidate**, **Return for correction**,
  **Approve deployment**, **Validate hours**, **Post register**.
- Confirmation dialogs name the record, resulting state, effective date, and
  irreversible effects.
- Use **Return** when work can be corrected and resubmitted; **Reject** when a proposal
  ends; **Cancel** when the process/request ends for operational reasons; **Rescind**
  when an issued offer or approved future action is withdrawn.
- Use **AM Verified** for published Deployed headcount and **Validated** for approved
  GP-Client hours.
- Never label Directory People as “Bundy employees,” CSM Verified as “DTR,” or
  GP-Client as the payroll register.

## 18. Implementation acceptance checklist

- [ ] Shell order, product names, entity labels, and deep links match this document.
- [ ] Persona homepage cards query the same filtered endpoints as their lists.
- [ ] Inbox tasks are deterministic and complete from business actions.
- [ ] Universal search enforces authorization before returning result text.
- [ ] Every record has identity, business status, sync status, next action, and
      paginated Activity.
- [ ] Candidate conversion and movement wizards have four or fewer named steps,
      server drafts, match-first identity, and idempotent submit.
- [ ] Packet checklist shows blocking counts, owner, version, return reason, and audit.
- [ ] Worker portal hides unavailable Clock functionality; client portal exposes only
      allowlisted staffing data.
- [ ] Every operational list has server-side pagination, filters, search, URL state,
      loading/error/empty states, and accessible row actions.
- [ ] Mobile layouts avoid mandatory two-axis scrolling for primary tasks.
- [ ] Keyboard-only users can search, filter, open, review, and perform every granted
      command.
- [ ] Partial cross-product failures show durable local truth and a safe retry path.
- [ ] Organic routes contain no CSM/GP-Client dependency; Deployed handoffs preserve
      Directory UUIDs and product ownership.
