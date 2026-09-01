# GREENHRISMAIN is a catalog, not an amount oracle

Organic pay amounts are **GP-HRIS + current PH rules** (DOLE premiums, SSS / PhilHealth / Pag-IBIG / BIR). GREENHRISMAIN supplies **variables, table relationships, and procedure behavior** to harvest; encoded register totals may be wrong. **Sample match** is a diagnostic appendix (encoding fault vs missing GP variable), not the dual-run exit.

Amends [0007](./0007-organic-cutover.md): weekly Office payroll writes stop after **two consecutive** Organic cutoffs **finished entirely in GP** (Payroll register posted, remittance + bank files produced) with written sign-off from Admin Mike Razal and Account Manager Michelle Razal. Amount-equality with SQL Server is not required.

Harvest of the Organic pay spine: [PAY_SPINE_HARVEST.md](../legacy-greenhrismain/PAY_SPINE_HARVEST.md). Do not clone `payroll_summary` (~297 columns) or EXEC the T-SQL as the runtime.

## Status

Accepted — 2026-09-01.

## Consequences

- C4 (Statutory + Premiums in `lib/ph-payroll`) ports **keep** rows from the harvest, not GREENHRISMAIN totals.
- July 2026 CSVs remain a diagnostic corpus; they do not veto cutover.
- Payroll history import (YTD, open loans, 13th month) stays a later, separate path.
