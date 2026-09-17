# Architecture essentials

The one-screen map of Green Pasture’s three live apps plus this HRIS. Load [Architecture.md](./Architecture.md) when implementing a seam; load [PRD.md](../PRD.md) for product scope.

## The one process

```
CSM-GP                         GP-HRIS                         GP-Client (timekeeping)
headcount / AS→AM              person + pay                    per-client DTR rules
─────────────                  ────────────                    ─────────────────────
AM Verified roster    ──IDs──► Directory (201,                 Period + Timesheet
  (Deployed only)              branch, position,               (pay format, ND, OT,
                               engagement)                      overnight, allowances)
                                      │                                │
                                      │         Cutoff hours ◄─────────┘
                                      │         (ingest API)
                                      ▼
                               Payroll register
                               (hours × rates, statutory,
                                loans, remittance, bank)
```

Organic skips CSM and GP-Client: **Clock → Cutoff hours → Payroll register** inside this repo.

## Who owns what

| Thing | Owner | Others |
|---|---|---|
| Person, 201, employee code | Directory in GP-HRIS | Siblings copy UUIDs |
| Deployed site + active/resigned | CSM Approve / Transfer / Resign writes Directory Engagement | Same person; no second 201 |
| Client / branch catalog + rates | Directory | CSM and GP-Client project them |
| Deployed headcount publish (Draft → Verified) | CSM-GP | Downstream reads Verified **keyed by Directory IDs** |
| Per-client timesheet rules + DTR | GP-Client | Pushes **Cutoff hours**, not punches, into GP-HRIS |
| Organic GPS clock, leave, OT, portal | GP-HRIS `public.employees` | Linked via `directory_employee_id` |
| Payroll register, remittance, bank files | GP-HRIS | GP-Client has no payroll |
| Billing / admin fee (Deployed) | GP-HRIS after posted register | Organic has **no billing twin** |
| Tenant | `directory.organizations` | Client is a **view**, not a database |

Canonical IDs: `organization_id`, `client_id`, `directory_employee_id`. Optional: `branch_id` (payroll site), `directory_department_id` (CSM store), `position_id`. Never key payroll or CSM on GREENHRISMAIN `Employee_id` or a superseded engagement.

## Where we are (2026-09)

| Seam | Shipped | Not yet |
|---|---|---|
| Directory kernel + People UI | Yes (`schema directory`, `/people`) | CSM and GP-Client still keep their own people tables |
| Organic Clock + enrollment | Yes (`time_clock_entries`, `/time/enrollment`) | Deployed mass bundy (forbidden) |
| Organic cutoff register | Yes (`/payroll` aggregate → post → exports) | Two consecutive GP-complete cutoffs + Mike/Michelle sign-off |
| Cutoff ingest API | Yes `POST /api/timekeeping/cutoff-periods/:id/ingest` | GP-Client Validated now POSTs ingest when Directory env is set; `tbl_timekeep` JSON still dual-runs |
| Deployed payroll in GP-HRIS | `/payroll` org switcher + site filter; schema holds any Client | Nabati `/payroll` post + files; GREENHRISMAIN still pays Deployed |
| CSM ↔ Directory | UUID columns + linker; Approve/Transfer/Resign writes Engagement | CSM still does not create a 201 |
| GP-Client ↔ Directory | UUID columns live; linked sites add from AM Verified; Validated ingest | Unlinked sites still dual-run JSON only; Nabati Batangas Aug 16–31 ingested (20 hours + draft register); 7 names skipped |

Three person files exist today. The target is **one Directory person**, with CSM Verified and GP-Client roster as projections. How a Deployed cutoff runs: [THREE_APP_PROCESS.md](./THREE_APP_PROCESS.md). UUID columns and ingest: [DEPLOYED_INTEGRATION.md](./DEPLOYED_INTEGRATION.md).

## Two Organizations

| Org | Who | Time | Pay today | Pay target |
|---|---|---|---|---|
| **Organic** | GP house (~99–140) | Live GPS bundy | Dual-run: `/payroll` register + `/payroll-office` weekly; GREENHRISMAIN until cutover | GP-HRIS register only |
| **Deployed** | Client sites (~29k), branches + positions | GP-Client DTR (client rules) | GREENHRISMAIN from `tbl_timekeep` | Same register, hours from ingest; enroll bundy per Client later |

## Hard seams

- Siblings call GP-HRIS HTTP (`x-directory-api-key` + `x-organization-id`). They do not PostgREST `directory.*`.
- Deployed DTR does not INSERT `time_clock_entries`. Grain is cutoff hours, not punches.
- Posted `payroll_register_runs` do not change amounts. After Post → hours-based **Adjustment** run ([ADR 0017](../adr/0017-hours-based-adjustment-runs.md)).
- GREENHRISMAIN is catalog + diagnostic sample match, not an amount oracle.

## Code map (this repo)

```
app/people/**          Directory UI (org → client → 201)
app/payroll/**         Cutoff hub (Organic + Deployed)
app/time/**            Clock ops, enrollment, leave/OT/FTL
app/employee-portal/** Bundy + self-service
app/api/directory/**   Sibling + UI contract
app/api/timekeeping/** Cutoff periods, ingest, register, exports
lib/directory/         Person, engagement, roster, auth
lib/timekeeping/       Hours grain, office aggregate
lib/payroll-register/  Build / post / report pack
lib/ph-payroll/        PH statutory + premiums (shared by register and weekly path)
supabase/migrations/   202 Directory · 208 cutoff hours · 213 register
```
