# Six product areas (+ Admin ops)

The HRIS working set is People, Benefits, Payroll, Time, Reporting, Admin ops tools, and Employee self-service. Settings is a gear, not a product area. Office payroll stays a dual-run path until Organic cutover, not a product area. Directory 201 (People) and Bundy enrollment (Time) stay unmerged UIs ([0004](./0004-office-employees-align-with-201.md)).

## Status

Accepted — 2026-09-01. Amended 2026-09-28: diagnostic tools (Overview, Register, BIR, Audit, Devices, parity/audits) moved from Reporting into an **Admin** hub so Reporting can hold remittance/business reports.

## Considered options

- Keep the 20-link sidebar and only regroup labels — still overloads HR.
- Merge 201 and enrollment into one employee screen — rejected; Clock/portal rows are not the person master.
- Treat Office payroll as the Payroll product — rejected; live ops are the Organic cutoff hub.
- Keep diagnostics under Reporting — rejected once remittance reports needed a clear home; Admin holds ops/diagnostic tools.

## Consequences

- HR chrome is **People, Benefits, Payroll, Time, Reports, Admin** plus Settings.
- **Reports** holds remittance and payroll business reports.
- **Admin** holds dashboards, register explorer, BIR/alphalist tooling, audit log, devices, and admin-only parity/audit tools.
- Employees use `/employee-portal`.
- `/payroll-office` is reachable from Settings for admins during dual-run only.
