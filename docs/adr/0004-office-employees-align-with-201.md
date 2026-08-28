# Office employees align with Directory 201

## Status

Accepted — migration `207_align_office_employees_with_directory_201.sql`

## Context

GP-HRIS is being redesigned. Office staff (~99) on `public.employees` and Organic 201 files in `directory.employees` should share the same **identity and HR field names**, so:

- Reconcile / sync is a column mapping, not a translation layer forever
- New UI can read one shape (`employees_as_201` view or aligned columns)
- Clock / leave / OT modules keep working during transition

Architecture rules unchanged ([0001](./0001-directory-owns-tenancy.md)):

- **Directory** owns tenant + Client view + full 29k deployed roster + 201 children
- **public.employees** owns office bundy, SIL, OT groups, portal login
- Link: `directory_employee_id`, `directory_client_id`

## Decision

Add Directory-shaped columns to `public.employees` and mirror legacy columns with a trigger until the app is fully migrated.

### Column map (Directory → Office)

| Directory `employees` | `public.employees` (new) | Legacy (kept for now) |
|---|---|---|
| `organization_id` | `organization_id` | — |
| `client_id` | `directory_client_id` | already existed |
| `branch_id` | `branch_id` | — |
| `position_id` | `position_id` | `position` (text, synced from FK) |
| `employee_code` | `employee_code` | `employee_id` |
| `middle_name` | `middle_name` | `middle_initial` |
| `sex` | `sex` | `gender` |
| `status` | `status` | `is_active` |
| `daily_rate` | `daily_rate` | `per_day` |
| `billing_daily_rate` | `billing_daily_rate` | — |
| `ecola` | `ecola` | — |
| `tin` | `tin` | `tin_number` |
| `regular_date`, `resign_date` | same | — |
| `tax_status`, bank, gcash, pay_through | same | — |
| `email`, `mobile` | same | — |
| `legacy_id` | `legacy_id` | — |

### Office-only (not on Directory employee row)

Stay on `public.employees`:

- `portal_password`, `eligible_for_ot`, `overtime_*`, `employee_type`, `job_level`
- SIL / maternity / paternity credits
- `assigned_hotel`, `employee_location_assignments`
- `monthly_rate` (payroll convenience; derived from `daily_rate × 26` when empty)
- `full_name` (display composite)
- `company_id`, `transferred_from_employee_id`

### 201 child sheets

Dependents, education, contacts, etc. remain in `directory.employee_*` tables. Office rows linked via `directory_employee_id` read/write 201 children through Directory APIs — do **not** duplicate child tables on `public`.

### Read model

`public.employees_as_201` — office row with Directory column names + clock extensions.

## Consequences

- **Migration 207** backfills from legacy columns and linked Directory rows
- **Trigger** `sync_employees_201_legacy_columns` keeps old and new columns in sync on INSERT/UPDATE
- App code can migrate gradually: new forms use `employee_code`, `sex`, `status`, `daily_rate`; old paths still work
- Eventually drop legacy columns (`employee_id`, `gender`, `is_active`, `per_day`, `tin_number`, `middle_initial`, free-text `position`) once all routes use 201 names

## Not in scope (yet)

- Merging `/employees` UI into `/directory` (still separate surfaces)
- Dropping `public.employees` in favor of Directory-only identity
- Adding 201 child tables under `public`
