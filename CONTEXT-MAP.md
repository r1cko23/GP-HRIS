# Context Map

Green Pasture HRIS is one Supabase project (Pro). Directory is a schema in that project so clock-in/out, leave, and OT stay on `public.employees`.

**End-state product split:** GP-HRIS owns Directory + **office live bundy (~99)**; **GP-payroll-timekeeping-attendance** owns deployed DTR/cutoff (~29k); payroll register consumes approved cutoff from either path. CSM owns operations/billing. All siblings call `/api/directory/*` (see [DIRECTORY_INTEGRATION.md](./docs/architecture/DIRECTORY_INTEGRATION.md), [ADR 0005](./docs/adr/0005-office-clock-vs-deployed-timekeeping.md)).

## Contexts

- [Directory](../GP-Directory/CONTEXT.md) — schema `directory`: organizations, clients, branches, positions, 201-file employees
- [HRIS](./CONTEXT.md) — Directory UI, leave, overtime requests, GPS clock, office payslips on `public.employees`
- [Timekeeping](../GP-Client-Attendance-Payroll/CONTEXT.md) — cutoff periods and timesheets; stores Directory IDs (future host may split from payroll)
- CSM-GP — operations / billing; does not own the employee row

## Relationships

- **Directory → HRIS**: `public.employees.directory_employee_id` / `directory_client_id`; APIs at `/api/directory/*`
- **Directory → Timekeeping / Payroll**: sibling apps store `directory_client_id` / `directory_employee_id`; consume rates from positions
- **Clock → Payroll**: two sources, one cutoff shape. **Office (~99):** live punches on `time_clock_entries` → cutoff document. **Deployed (~29k):** DTR from GP-payroll-timekeeping-attendance → same cutoff document keyed by `directory_employee_id`. Punches never post directly to payroll register.
- **CSM-GP → Directory**: writes deployment status through Directory APIs
- **GREENHRISMAIN → Directory**: ETL into schema `directory` on `legacy_id` (employees done; 201 children when SQL reachable)
