# Office live clock vs deployed timekeeping (DTR)

## Status

Accepted — aligns with [0003](./0003-clock-does-not-call-greenhrismain.md) and [DIRECTORY_INTEGRATION](../architecture/DIRECTORY_INTEGRATION.md)

## Context

GP-HRIS has two populations under **Directory** (person SoT):

| Population | Count | Directory home | Time capture today |
|---|---|---|---|
| **Organic / GP house** | ~99–140 | Directory → Organic → GREEN PASTURE PEOPLE MANAGEMENT INC. | Live GPS bundy via linked `public.employees` (`directory_employee_id`) |
| **Deployed client staff** | ~29k | Directory → Deployed → Client | **GP-payroll-timekeeping-attendance** (manual / DTR); not live bundy yet |

Person master is always `directory.employees`. Bundy / leave / OT in GP-HRIS still need a linked `public.employees` row for the portal and `time_clock_entries`.

## Decision

### Organic — Directory master + optional bundy enrollment

- Maintain the person under **Directory → Organic**.
- Keep **GPS clock-in / clock-out** on `public.time_clock_entries` keyed by `public.employees.id`.
- Leave, OT, FTL, schedules, SIL stay on `public.employees`.
- Link clock rows with `directory_employee_id` (reconcile / create from Directory).
- Future office payroll path: aggregate approved punches → **Cutoff hours document** → office payroll register (same Supabase project).

### Deployed (~29k) — DTR from timekeeping app for now; bundy later

- **Today:** hours are captured / approved in **GP-payroll-timekeeping-attendance** (manual input / DTR), not live GP-HRIS bundy.
- **Do not** mass-onboard 29k into live `time_clock_entries`.
- **Later:** individuals can enroll in bundy the same way Organic does — create/link `public.employees` with `directory_employee_id`, without changing the Directory master.
- **GP-payroll-timekeeping-attendance** owns until then:
  - Cutoff periods per Client
  - DTR / timesheet capture (site punches, imports, adjustments)
  - Premium-hour matrix per person per cutoff (reg, OT, ND, LH, SH, RD, WDO — `tbl_timekeep` shape)
- That app stores Directory UUIDs (`organization_id`, `client_id`, `directory_employee_id`, optional `branch_id`, `position_id`).
- It calls GP-HRIS `/api/directory/*` for person + rates; it does **not** read `directory.*` via PostgREST directly.

### Seam: Cutoff hours document (not raw punch mirror)

Deployed DTR **does not** INSERT into `public.time_clock_entries` row-for-row. Reasons:

1. `time_clock_entries` FK is `public.employees.id` — most deployed people are not clock-enrolled yet.
2. DTR is **cutoff-grain** (approved hours matrix), not punch-grain (IN/OUT events).
3. Legacy payroll consumed `tbl_timekeep`, not live punches.

```
Organic path (bundy enrolled):
  directory.employees (Organic)
    → public.employees (clock access, directory_employee_id)
    → time_clock_entries (live IN/OUT)
    → approve / aggregate
    → cutoff_hours
    → payroll register

Deployed path (today):
  directory.employees (Deployed)
    → GP-payroll-timekeeping-attendance (DTR / cutoff capture)
    → cutoff_hours (keyed by directory_employee_id)
    → payroll register

Deployed path (future, per-person enrollment):
  directory.employees (unchanged)
    → public.employees (bundy access linked)
    → same live clock path as Organic
```

Both paths converge on the same **Cutoff hours document** concept; only the **source** differs (live clock vs timekeeping app).

### What “fill clock in and clock out” means

If GP-HRIS or payroll UI needs to **show** deployed IN/OUT for audit:

- Read from the **timekeeping app’s punch/DTR store** (or its API), **or**
- Derive display rows from the approved cutoff document — not from `time_clock_entries`.

Do not backfill 29k deployed into office clock tables.

## Consequences

- **People SoT** = Directory for Organic and Deployed.
- **Time → Bundy clock access** (`/employees`) = enrollment / portal / GPS for people who punch here (~99 today; grows as more enroll).
- Deployed staff manage hours in the sibling app until enrolled.
- Shared cutoff grain: `cutoff_periods` / `cutoff_hours` (migration 208) keyed by `directory_employee_id` (and linked `office_employee_id` when bundy-enrolled).
- Reconcile / 201 sync on clock rows does **not** imply those people use deployed timekeeping unless `employee_type` and product rules say so.

## Out of scope here

- ~~Building cutoff_hours table~~ → **Done:** `cutoff_periods`, `cutoff_hours`, `cutoff_dtr_punches` (migration 208) + `/api/timekeeping/cutoff-periods/*`
- GP-payroll-timekeeping-attendance UI (calls ingest API from sibling app)
- Merging payslip UIs across apps
- Auto-enrolling all deployed into bundy
