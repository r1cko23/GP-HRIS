# Catalog-driven HRIS development

GREENHRISMAIN is a **read-only catalog**: table shapes, procedure behavior, report column lists, and historical rows. GP-HRIS owns **runtime amounts** under current PH rules ([0009](./0009-greenhrismain-is-catalog.md)). We build a better HRIS by porting **relationships and variables**, then proving parity where legacy data exists — not by cloning 297-column tables or EXEC-ing T-SQL.

## Status

Accepted — 2026-09-01.

## Layers

| Layer | GREENHRISMAIN | GP-HRIS |
|---|---|---|
| Identity | `Employee.Employee_id` | `directory.employees` + `legacy_id` |
| Client calendar | `client` cutoff fields | `directory.clients` pay calendar |
| Cutoff hours | `tbl_timekeep` | `cutoff_hours` (roster-first + Bundy) |
| Register | `payroll_summary` | `payroll_register_lines` (JSON hours/earnings/deductions) |
| Loans | `loan` / `loanschedule` / `otherdeduction` | `employee_loans` + `loan_lines` on register |
| Reports | Crystal / `USP_*` | `/exports` CSV/PDF + Reports parity UI |

## How we use the catalog

1. **Harvest** — Document keep/drop/later in [PAY_SPINE_HARVEST.md](../legacy-greenhrismain/PAY_SPINE_HARVEST.md) and [CUTOFF_REPORT_PACK.md](../legacy-greenhrismain/CUTOFF_REPORT_PACK.md).
2. **ETL** — One-way import scripts (`etl-greenhrismain-directory`, `etl-greenhrismain-loans`) keyed on `legacy_id`.
3. **Parity** — `lib/legacy-greenhrismain/payroll-summary-parity` + Reports → Cutoff parity compares GP register to `payroll_summary` for the same client dates. Mismatches classify missing variables vs encoding faults; they do **not** block cutover.
4. **Never** — INSERT/UPDATE/EXEC on SQL Server from Clock or Payroll runtime ([0003](./0003-clock-does-not-call-greenhrismain.md)).

## Consequences

- New payroll/report features start from legacy proc **column lists**, implemented in GP libs — not copied totals.
- Organic cutover exit is **two GP-native cutoffs posted with Finance files**, not amount equality with MAIN.
- Deployed clients can reuse the same parity tool once `directory.clients.legacy_id` is set.
