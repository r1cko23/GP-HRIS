# Architecture

Green Pasture runs **three product apps** that must share one employment process. This document is the system architecture for that process, centered on **GP-HRIS** (this repo). Condensed map: [architecture-essentials.md](./architecture-essentials.md). Product scope: [PRD.md](../PRD.md).

## 1. System map

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GREENHRISMAIN (SQL Server, office LAN)                                  │
│  Read-only catalog + current production pay for Deployed                 │
│  (and Organic until cutover). No runtime INSERT/EXEC from GP-HRIS.       │
└──────────────────────────────────────────────────────────────────────────┘
         ▲ ETL / sample-match (VPN)          ▲ tbl_timekeep JSON (today)
         │                                   │
┌────────┴─────────┐  ┌──────────────────────┴─────────┐  ┌────────────────┐
│ GP-HRIS          │  │ GP-Client-Attendance-Payroll   │  │ CSM-GP         │
│ Next.js +        │  │ Next.js                        │  │ Next.js        │
│ Supabase Pro     │  │ own Supabase                   │  │ own Supabase   │
│                  │  │                                │  │                │
│ Directory schema │  │ Periods, timesheets,           │  │ AS Draft /     │
│ Clock, leave, OT │  │ per-client rules, pay format   │  │ AM Verified    │
│ Organic register │  │ Export: hris-timekeep JSON     │  │ Transmittal    │
│ /api/directory   │  │ Target: POST ingest to HRIS    │  │ audit          │
│ /api/timekeeping │  │ No payroll engine              │  │ No Directory   │
└────────┬─────────┘  └────────────────────────────────┘  │ IDs yet        │
         │                                                └────────────────┘
         │  schema directory + public (clock, cutoff_hours, register)
         ▼
   GP-HRIS Supabase (one project — do not split)
```

**GP-Directory** (`../GP-Directory`) is a retired standalone prototype. The kernel lives in this repo (`schema directory`). Prefer GP-HRIS for Directory work.

Hosts later: three apps, one Directory contract. Same Supabase Pro for HRIS + Directory + Organic clock/payroll. CSM and GP-Client keep their own databases and **store Directory UUIDs**.

## 2. Tenancy

| Layer | Entity | Isolation |
|---|---|---|
| Tenant | `directory.organizations` | Row `organization_id`. Two live orgs: **Deployed**, **Organic**. |
| Working set | `directory.clients` | Filter (`client_id`). Not a second project. |
| Site | `directory.client_branches` | Deployed sites. CSM “outlet” maps here. |
| Rate card | `directory.positions` | Payroll + billing rates at a branch. |
| Person | `directory.employees` | One master 201 per human; current engagement flags the live row. |

Hybrid org gate ([ADR 0008](../adr/0008-engagement-bundy-enrollment.md)): service key any org; Admin any org; HR-family via `directory.organization_members`.

Attendance / payroll siblings bind **one** `directory_client_id` locally.

## 3. Identity model

```
directory.employees          ← person master (Organic + Deployed)
  employee_code              ← stable business ID (immutable on rehire)
  client_id, branch_id,
  position_id, status        ← current Engagement
  is_current_engagement      ← live roster
  legacy_id                  ← ETL only

public.employees             ← Bundy / portal / leave / OT (~99 today)
  directory_employee_id      ← enrollment link
  directory_client_id

GP-Client roster_employees   ← Period-local copy (target: directory_employee_id)
CSM draft / verified rows    ← Headcount workflow (target: directory_employee_id)
```

Rehire updates the master; it does not create a second person ([ADR 0006](../adr/0006-person-is-master-rehire-updates.md)). Status vocabulary: `active` | `inactive` | `barred` | `float` | `for_release` | `for_verification`. Regular cutoff = `active` only. `for_release` is final-pay, not the kinsena.

Headcount for ops = `directory.roster_current` (current engagement). CSM **AM Verified** is the published Deployed working roster — it must eventually point at those same UUIDs, not a parallel name list.

## 4. Time → pay grain

Payroll never reads raw punches.

```
Organic (bundy enrolled)
  time_clock_entries + OT/leave
    → POST .../aggregate-from-office
    → cutoff_hours (premium-hour matrix)
    → payroll_register_runs / lines
    → exports (payslips, remittance, bank)

Deployed (today)
  GP-Client Timesheet (client rules)
    → GET .../hris-timekeep  (tbl_timekeep JSON)
    → office agent INSERT GREENHRISMAIN
    → GREENHRISMAIN payroll_summary

Deployed (target)
  GP-Client Timesheet
    → POST /api/timekeeping/cutoff-periods/:id/ingest
    → same cutoff_hours → same payroll register
```

`cutoff_hours` is `tbl_timekeep` grain: one row per person per cutoff, columns for RH / OT / ND / LH / SH / RD / WDO and combos. Optional `cutoff_dtr_punches` for audit display. Do not backfill 29k into `time_clock_entries`.

Organic hub steps: **Aggregate → Audit → Approve → Build → Post → Downloads** (`lib/payroll-register/organic-cutoff-workflow.ts`). Human gate stays: Pat Relos’s audit/approval is not skipped because punches are automatic ([ADR 0003](../adr/0003-clock-does-not-call-greenhrismain.md)).

Posted runs are immutable. Corrections = **catch-up** on a later open cutoff ([ADR 0012](../adr/0012-next-cutoff-catchup.md)).

## 5. Per-client timekeeping (GP-Client)

Deployed clients do not share one hour engine. GP-Client stores **Timesheet rules** per Client (overnight split, straight shift, ND-to-the-minute, NDOT-as-ND, OT paid minimum, late/UT on ND, RH-as-days, allowances, export layout) and a **pay format** (workday target / weekly / daily uncapped) on each Period.

Those rules stay in GP-Client. GP-HRIS consumes the **approved hour matrix**, not the rule flags. Payroll in GP-HRIS applies Directory rates + Client statutory policy + PH formulas (`lib/ph-payroll`).

## 6. CSM headcount (Deployed)

CSM is Account Supervisor **Draft** → Account Manager **Verified**, with Lock on the 2nd and 17th (Asia/Manila) and Transmittal Audit against Verified. It answers “who is on this client this cutoff?” for operations.

Target: Verified rows keyed by `directory_employee_id`. Hire still happens in People. CSM Add picks that 201 (org-wide search); Approve / Transfer / Resign writes the Directory Engagement on the same person. CSM never inserts a second 201.

Organic house staff are **not** a CSM roster.

## 7. GP-HRIS internals

### 7.1 Apps and hubs

| Hub | Routes | Data |
|---|---|---|
| People | `/people`, `/people/c/:clientId`, 201 | `directory.*` |
| Benefits | `/benefits/loans` etc. | `employee_loans`, cutoff allowances/deductions, statutory IDs |
| Payroll | `/payroll`, `/payroll/[id]` | `cutoff_periods`, `cutoff_hours`, `payroll_register_*` |
| Time | `/time/*` | `public.employees`, clock, leave, OT, FTL, schedules |
| Reporting | `/reports/*` | register exports, BIR, audit, parity, payroll-audit OCR |
| Employee self-service | `/employee-portal` | bundy, requests, payslips |
| Settings | `/settings` | users, grants, holidays; dual-run `/payroll-office` |

### 7.2 Directory HTTP contract

Siblings: `x-directory-api-key` = `DIRECTORY_SERVICE_API_KEY`, `x-organization-id` = tenant UUID. Browser UI uses the Admin/HR cookie. Full table: [DIRECTORY_INTEGRATION.md](./DIRECTORY_INTEGRATION.md).

Stable groups:

- `/api/directory/organizations|clients|positions|employees…` — master data
- `POST /api/directory/employees/:id/rehire` — rehire, no new code
- `/api/timekeeping/cutoff-periods` — list/create
- `POST .../ingest` — upsert hours + punches (Deployed DTR)
- `POST .../aggregate-from-office` — Organic bundy → hours
- `POST/GET .../payroll-run` + `.../post` + `.../exports` — register

Success `{ data }`, errors `{ error }`. Webhooks (optional): `employee.upserted`, `employee.status_changed`, `employee.rehired`.

### 7.3 Schema (HRIS project)

| Schema / tables | Role |
|---|---|
| `directory.organizations, clients, client_branches, positions, employees, …` | Tenant + 201 + engagement |
| `public.employees`, `time_clock_entries`, leave/OT/FTL | Bundy enrollment |
| `cutoff_periods`, `cutoff_hours`, `cutoff_dtr_punches` | Shared time grain |
| `payroll_register_runs`, `payroll_register_lines`, loan posts, catch-up | Organic (then Deployed) pay |
| `weekly_attendance`, `payslips` | Dual-run Office path until cutover |
| `employee_loans` | SoT after Organic cutover |

PostgREST exposes `directory` for service_role; apps go through `/api/directory/*`.

### 7.4 Formulas

`lib/ph-payroll` is the single composition of SSS / PhilHealth / Pag-IBIG / WTax and DOLE premiums. The cutoff register and the weekly Office path both compose it. Port **keep** variables from the GREENHRISMAIN harvest; do not clone `payroll_summary` ([ADR 0011](../adr/0011-catalog-driven-hris.md)).

Organic statutory policy is Monthly: SSS/PhilHealth/Pag-IBIG on the second window; WTAX every cutoff. Client pay calendar and statutory flags live on `directory.clients`, not in Settings.

## 8. Access

ABAC: **Grant** = one Page or Function on a User. Starter packs (Admin, Head of HR, Approver) seed checkboxes. Attributes (org membership, assigned clients) scope rows. Do not gate APIs on `role === "admin"` alone.

CSM and GP-Client have their own grant catalogs. Unifying logins is a later program; unifying **person IDs** is the current program.

## 9. Dual-run and cutover

Organic still finishes remittance/bank in GREENHRISMAIN until **two consecutive** cutoffs are finished entirely in GP (posted register + remittance + bank files) with written sign-off from Admin Mike Razal and Account Manager Michelle Razal ([ADR 0007](../adr/0007-organic-cutover.md), [ADR 0009](../adr/0009-greenhrismain-is-catalog.md)). Amount-equality with SQL Server is diagnostic only (July 2026 golden corpus).

Then: stop weekly `/payroll-office` writes; GP-HRIS is the only Organic encoding surface. Deployed follows **one Client at a time**, same cutoff shape, no mass bundy.

## 10. What not to do

- Stand up a second Supabase project for Directory.
- Merge `/people` and `/time/enrollment` into one employee screen.
- Treat Office weekly payslips as the Payroll product.
- Push Deployed punches into `time_clock_entries`.
- Let CSM or GP-Client become a second person master.
- EXEC GREENHRISMAIN procedures from Clock or Payroll runtime.
- Void a posted register to fix money.

## 11. Related docs

| Doc | Use |
|---|---|
| [THREE_APP_PROCESS.md](./THREE_APP_PROCESS.md) | Deployed cutoff: who does what |
| [DEPLOYED_INTEGRATION.md](./DEPLOYED_INTEGRATION.md) | UUID columns, ingest, hour map |
| [DIRECTORY_INTEGRATION.md](./DIRECTORY_INTEGRATION.md) | Frozen sibling API |
| [DIRECTORY_LIFECYCLE.md](./DIRECTORY_LIFECYCLE.md) | Hire / transfer / release / needs-review |
| [DIRECTORY_PERSON_MASTER.md](./DIRECTORY_PERSON_MASTER.md) | Rehire collapse + codes |
| [ORGANIC_PAYROLL_E2E.md](./ORGANIC_PAYROLL_E2E.md) | Hub routes and export types |
| [../adr/README.md](../adr/README.md) | Decisions 0001–0012 |
| [../../CONTEXT.md](../../CONTEXT.md) | Glossary |
| [../../CONTEXT-MAP.md](../../CONTEXT-MAP.md) | Context relationships |
