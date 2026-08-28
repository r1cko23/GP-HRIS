# Organic cutover: leave GREENHRISMAIN for GP house pay

## Status

Accepted — product confirm 2026-08-27. Aligns with [0003](./0003-clock-does-not-call-greenhrismain.md), [0005](./0005-office-clock-vs-deployed-timekeeping.md), and [ORGANIC_PAYROLL_E2E](../architecture/ORGANIC_PAYROLL_E2E.md).

## Context

Organic / GP house staff already clock in GP-HRIS. Ops still finish pay, remittance, and bank files in **GREENHRISMAIN**. Directory ETL moved people/201 — not full payroll history. The Organic cutoff hub (`Clock → Cutoff hours → Payroll register → exports`) ports **behavior**, not a 1:1 SQL Server clone.

Goal: move all live encoding and remittance/bank generation into GP-HRIS, then stop using GREENHRISMAIN for Organic.

## Decision

### Scope order

1. **Organic first** — prove register + exports + sample match.
2. **Deployed later** — same product shape (`Clock → Cutoff hours → Payroll register`), rolled out **one client at a time** after Organic is proven. Do not mass-onboard ~29k into bundy.

### Live path (not schema clone)

- Source of truth for ongoing Organic pay: GP-HRIS **Payroll register**.
- Port formulas/behavior from GREENHRISMAIN; do not clone tables/procs as the product model.
- **No billing twin** for Organic / house staff.

### Dual-run until exit

- Keep **Office payroll** (weekly `weekly_attendance` → payslips) in parallel with the cutoff register until exit.
- Exit weekly write path after **two consecutive** full Organic cutoffs that pass **sample match** (Finance + HR sign-off).
- During dual-run, **dual-update open loans** in both systems so loan timing does not fake-fail the match; after exit, GP-HRIS `employee_loans` is SoT.

### Sample match

- Golden month: **July 2026** (Organic / GREEN PASTURE PEOPLE MANAGEMENT INC.).
- Periods:
  - **2026-07-01 → 2026-07-15** — `e781658c-cfda-4a12-bf32-063011ef3fb3`
  - **2026-07-16 → 2026-07-31** — `35f279c1-e163-4f13-bcd8-460469c8758e` (primary closed golden)
- Dual-run exit still requires **two consecutive** matched cutoffs (both July kinsenas qualify).
- Replay script: `npx tsx scripts/organic-july-sample-match.ts` (GREENHRISMAIN via `SQL_*`; `--skip-legacy` for GP-only).
- Line-level: all active bundy staff — gross, statutory, loans, net.
- Statutory: coded helpers first; contribution tables only if match fails.
- Mismatch handling: **HR + Finance jointly** sign in writing which side is correct per mismatch class. Named owners: **Admin Mike Razal** and **Account Manager Michelle Razal**. Prefer validating current PH rules over blindly cloning stale legacy output.

### Payroll history import (continuity, not the live path)

- Import **current-year YTD** + **open loan balances/schedules** so remittance / alphalist / ongoing deductions work without SQL Server.
- Multi-year register history only if Finance still needs it inside GP (not Excel/exports).
- Distinct from Directory people ETL.

### After Organic cutover

- GP-HRIS is the only place Organic encodes hours adjustments, loans, deductions, and generates remittance/bank files.
- GREENHRISMAIN remains readable only as long as needed for sample match / extract; Organic ops do not use it going forward.

## Consequences

- Cutover is blocked on sample match + dual-run exit, not on “all GREENHRISMAIN tables in Supabase.”
- Deployed gradual enrollment is a later program; ADR 0005 still governs “no mass bundy” until a client is deliberately enrolled.
- Glossary: see root `CONTEXT.md` — Organic cutover, Sample match, Payroll history import, Deployed gradual enrollment.

## Out of scope (this ADR)

- Deployed client billing twin / CSM billing.
- Mass recode of live employee IDs / portal passwords.
- Cloning GREENHRISMAIN EXEC procedures as the runtime.
