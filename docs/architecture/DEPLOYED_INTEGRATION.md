# Deployed integration architecture

How CSM, GP-Client, and GP-HRIS share identity and how Validated hours become a payroll register. Process (ops sequence): [THREE_APP_PROCESS.md](./THREE_APP_PROCESS.md). Sibling HTTP: [DIRECTORY_INTEGRATION.md](./DIRECTORY_INTEGRATION.md).

**Status:** design for Phase B. Ingest API exists in GP-HRIS. GP-Client Validated now calls it when Directory env is set. Dual-run `tbl_timekeep` JSON remains.

---

## 1. Topology

Three Next.js apps, three databases. **One person namespace:** Directory UUIDs on the GP-HRIS Supabase project.

```
CSM-GP Supabase              GP-Client Supabase               GP-HRIS Supabase
csm_clients                  clients                          directory.clients  (employer)
  directory_client_id ─────── directory_client_id ──────────► id
  directory_branch_id ─────── directory_branch_id ──────────► directory.client_branches  (site)
csm_employees_*              roster / period employees        directory.employees
  directory_employee_id      directory_employee_id            id
                             directory_position_id            (two rows if two jobs)

                             Validated Period (per site)
                               POST ingest ──────────────────► cutoff_periods (client+branch+dates)
                                                               cutoff_hours unique
                                                                 (period, employee, position)
                                                               payroll_register_lines
```

Siblings **never** PostgREST `directory.*`. They call:

```
https://<gp-hris-host>/api/directory/*
https://<gp-hris-host>/api/timekeeping/*
Headers: x-directory-api-key, x-organization-id
```

`x-organization-id` for this path is the **Deployed** organization UUID (not Organic).

GP-Client keeps **Timesheet rules** locally. GP-HRIS never imports those flags. It stores the resulting hour matrix.

---

## 2. Identity columns to add

### GP-Client (`GP-Client-Attendance-Payroll`)

| Table | Column | Points at |
|---|---|---|
| `clients` | `directory_client_id UUID NULL` | `directory.clients.id` |
| `clients` | `directory_organization_id UUID NULL` | Deployed org (cache; header still required) |
| `clients` | `directory_branch_id UUID NULL` | `directory.client_branches.id` (this site) |
| `roster_employees` | `directory_employee_id UUID NULL` | `directory.employees.id` |
| `roster_employees` | `directory_branch_id UUID NULL` | `directory.client_branches.id` |
| `roster_employees` | `directory_position_id UUID NULL` | `directory.positions.id` |
| `employees` (period-local) | same three UUIDs | copied from roster at seed |
| `periods` | `directory_cutoff_period_id UUID NULL` | `public.cutoff_periods.id` after create/ingest |

Keep existing `hris_client_id` / `hris_employee_id` (GREENHRISMAIN integers) for dual-run JSON and for **backfill** onto Directory via `legacy_id`.

Unique: roster/period rows unique on `(directory_employee_id, directory_position_id)` per Period — same person twice if two jobs.

### CSM-GP

| Table | Column | Points at |
|---|---|---|
| `csm_clients` | `directory_client_id UUID NULL` | `directory.clients.id` (employer) |
| `csm_clients` | `directory_branch_id UUID NULL` | `directory.client_branches.id` (this site) |
| `csm_employees_draft` | `directory_employee_id UUID NULL` | master person |
| `csm_employees_verified` | `directory_employee_id UUID NULL` | same ID as the draft once approved |

Approval/transfer copies the UUID. A Draft add without a Directory ID is incomplete: AS must pick a Directory person (or HR hires first).

### GP-HRIS (already)

`cutoff_hours` unique `(cutoff_period_id, directory_employee_id, position_id)`. `cutoff_periods` unique `(organization_id, client_id, branch_id, period_start, period_end)`.

---

## 3. Backfill (existing rows)

Do not match on display name as the primary key. Directory has hundreds of same-name groups.

| Have | Resolve |
|---|---|
| GP-Client `hris_employee_id` | `directory.employees.legacy_id` + org, `is_current_engagement = true` |
| GP-Client `hris_client_id` | `directory.clients.legacy_id` |
| Employee code on a sheet | `employee_code` or `employee_code_aliases` |
| Nothing but a name | Unique last+first **on that Directory Client**; skip if two people share the name |

Live GP-Client `hris_*` integers are still empty, so the first backfill is unique last+first on a name-matched site (`scripts/link-gp-client-directory.ts`). Re-run after integers exist — `legacy_id` wins when unique. Unmapped Period employees **cannot ingest**. They appear in a skipped list (same idea as today’s `hris-timekeep` `skipped`).

CSM: same legacy/code path where numbers exist; otherwise a Client-scoped linker.

---

## 4. Directory reads siblings need

| Call | When |
|---|---|
| `GET /api/directory/clients` | Bind a local client |
| `GET /api/directory/clients/:id/branches` | Outlet → Branch |
| `GET /api/directory/positions?client_id=` | Rate card |
| `GET /api/directory/employees?client_id=&status=active&limit=&offset=&q=` | Seed roster / Period |

Paginate. Cache copies of name, branch, position for the timesheet UI; **re-fetch rates at ingest/register**, do not treat a stale GP-Client daily-rate field as SoT.

Webhooks (`employee.upserted`, `employee.status_changed`): update roster name/status; do not insert a second person. If webhook is missing, GP-Client re-pulls on Period create.

---

## 5. Cutoff create + ingest

### 5.1 When

GP-Client period `validation_status === "approved"` (Validated). Not on draft encode. Re-ingest after a correction cycle that returns to Validated.

### 5.2 Create or reuse the HRIS period

```
POST /api/timekeeping/cutoff-periods
{
  "client_id": "<directory.clients.id>",
  "period_start": "2026-09-01",
  "period_end": "2026-09-15",
  "payroll_date": "2026-09-15",
  "pay_frequency": "semi-monthly",
  "source_app": "gp-payroll-timekeeping-attendance",
  "status": "approved",
  "notes": "gp-client period <uuid>"
}
```

If `(org, client, start, end)` already exists: GET that id. If HRIS status is `posted`, ingest returns **409** — do not overwrite; use catch-up.

Store returned id on `periods.directory_cutoff_period_id`.

### 5.3 Hours body

```
POST /api/timekeeping/cutoff-periods/:id/ingest
{
  "replace_existing": true,
  "hours": [ { "directory_employee_id": "...", ...matrix } ],
  "punches": [ ]   // optional audit; not required for pay
}
```

Ingest already validates: person exists, `is_current_engagement`, belongs to that `client_id`. Skip / fail closed on missing UUID.

`source_of_data`: `"GP-CLIENT"`.

### 5.4 Hour field map

Reuse the matrix GP-Client already builds for `GET /api/periods/{id}/hris-timekeep`. Map into `CutoffHoursIngestRow` (`lib/timekeeping/cutoff-types.ts`):

| GP-Client / tbl_timekeep | `cutoff_hours` |
|---|---|
| `actualregularhours` | `actual_regular_hours` |
| `noofhourswork` | `hours_work` |
| `Overtime_Hours` | `overtime_hours` |
| `Nightdiff_Hours` | `night_diff_hours` |
| `regularnightshiftOT_hours` | `regular_night_ot_hours` |
| `LegalHoliday_Hours` / OT / ND / `lhotndh` | `legal_holiday_*` / `legal_holiday_ot_nd_hours` |
| `Holiday_Special_*` / `shotndh` | `special_holiday_*` |
| `rdhours` / `RDothours` / `rdndhours` / `rdotndh` | `rest_day_*` |
| `lhwdohours` / `lhwdoothours` / … | `lh_rest_day_hours` / `lh_rest_day_ot_hours` (extend ingest if ND/OT-ND needed) |
| `shwdo*` | `sh_rest_day_*` |
| `WDOhours` | `wdo_hours` |
| `tardiness` | `tardiness_hours` |
| `undertime` | `undertime_hours` |
| `absences` | `absences_hours` |

Copy `branch_id` / `position_id` from Directory UUIDs on the period employee, not GREENHRISMAIN integers.

Rates: omit or send snapshot; **register build reads Directory** (`daily_rate` / monthly) so a stale timesheet rate cannot silently pay wrong.

Allowances computed in GP-Client (meal, COMM, gas, …) fold into `allowance` or wait for a structured earnings JSON — v1: sum into `allowance` and remarks; do not invent a second payroll in GP-Client.

---

## 6. Payroll in GP-HRIS

Same tables and UI as Organic:

1. `/payroll` lists cutoff periods for the session org (same Deployed/Organic switcher as People). Filter by Client and site. New Deployed cutoffs require `branch_id` and stamp `source_app` as GP-Client ingest.
2. Hub skips **Aggregate from office** when `source_app` is the timekeeping app (hours already ingested).
3. **Build register** → `payroll_register_lines` via `lib/ph-payroll` + Client statutory policy on `directory.clients`.
4. **Post** → loan posts, immutable run.
5. **Exports** unchanged query types.

Deployed `bundy_enabled` stays off unless that Client is deliberately enrolled. Ingest does not write `time_clock_entries`.

---

## 7. CSM in the loop

CSM does not call ingest. Deployed Periods seed from **AM Verified**, not from Directory Active. Ingest and the register only include Verified Directory IDs. Draft-only names never reach GP-Client.

Hire still happens in People if the person is not in Directory. AS adds Draft by picking that 201; they cannot type a new name. AM cannot Verify until `directory_employee_id` is set.

CSM and GP-Client keep their own databases ([ADR 0013](../adr/0013-deployed-verified-roster-three-databases.md)).

---

## 8. Dual-run with GREENHRISMAIN

Keep `GET /api/periods/{id}/hris-timekeep` until the Client exits SQL Server. Ingest and JSON export are two adapters on the **same** Validated totals. Do not maintain a third hour engine.

Office INSERT into `tbl_timekeep` stays an agent on the LAN (Vercel still cannot dial SQL Server).

---

## 9. Auth and env

| App | Needs |
|---|---|
| GP-HRIS | `DIRECTORY_SERVICE_API_KEY` (already) |
| GP-Client | same key, `DIRECTORY_API_BASE_URL`, Deployed `organization_id` |
| CSM | same key, same base URL, same org |

Browser users stay on each app’s session. Only **server** routes call Directory/timekeeping with the service key. Do not put the key in `NEXT_PUBLIC_*`.

---

## 10. Implementation order (no product expand)

1. **CSM schema + linker:** `directory_client_id` / `directory_employee_id`; Verify blocked without an Active Directory person.
2. **GP-Client schema:** Directory UUID columns (live). Backfill via `legacy_id` when `hris_*` is filled; until then unique last+first on a linked site.
3. **GP-Client:** seed Period from AM Verified on Directory-linked sites (picker + transmittal name match). No typed humans when the site is linked. `directoryIngestGaps` omits people without UUID from ingest.
4. **GP-HRIS hub:** hide Aggregate-from-office when `source_app` is GP-Client (`gp-payroll-timekeeping-attendance`). API returns 409.
5. **GP-Client:** on Validated, create/reuse cutoff period + POST ingest. Skip unlinked sites, missing Directory env, and people without `directory_employee_id` (do not block Validated). Dual-run `tbl_timekeep` JSON stays.
6. **Pilot Client** through `/payroll` post + files. `/payroll` can switch to Deployed and filter by site. **Nabati Batangas Aug 16–31 ingested** (`cutoff_periods.id` `992e9ea5-07e7-454a-bbf0-82040f8807e7`, 20 hours rows). Remaining: build/post register. Billing waits on Directory `billing_daily_rate`. 7 timesheet names skipped (3 unlinked, 4 Directory engagement on another site).

Completion criterion for step 5: a Validated Period produces `cutoff_hours` rows whose `directory_employee_id`s match Directory, with zero reliance on `tbl_timekeep` for the GP path. Billing is **after** that posted register in GP-HRIS ([ADR 0015](../adr/0015-client-billing-in-gp-hris.md)).

---

## 11. Guardrails

- GP-Client does not grow a register, SSS tables, or payslip PDF as the pay SoT.
- Ingest is cutoff grain, not `time_clock_entries`.
- Posted HRIS cutoffs are immutable.
- Mass bundy of 29k is out.
- New people are hired in Directory, not typed into a timesheet as identity.
