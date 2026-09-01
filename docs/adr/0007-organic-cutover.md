# Organic cutover: leave GREENHRISMAIN for GP house pay

## Status

Accepted — product confirm 2026-08-27. Dual-run **exit bar** and sample-match role amended by [0009](./0009-greenhrismain-is-catalog.md) (2026-09-01). Aligns with [0003](./0003-clock-does-not-call-greenhrismain.md), [0005](./0005-office-clock-vs-deployed-timekeeping.md), and [ORGANIC_PAYROLL_E2E](../architecture/ORGANIC_PAYROLL_E2E.md).

## Context

Organic / GP house staff already clock in GP-HRIS. Ops still finish pay, remittance, and bank files in **GREENHRISMAIN**. Directory ETL moved people/201 — not full payroll history. The Payroll cutoff hub under **Operations → Payroll** (`Clock → Cutoff hours → Payroll register → exports`) ports **behavior**, not a 1:1 SQL Server clone.

Goal: move all live encoding and remittance/bank generation into GP-HRIS, then stop using GREENHRISMAIN for Organic.

## Decision

### Scope order

1. **Organic first** — prove register + exports; harvest GREENHRISMAIN variables (not totals).
2. **Deployed later** — same product shape (`Clock → Cutoff hours → Payroll register`), rolled out **one client at a time** after Organic is proven. Do not mass-onboard ~29k into bundy.

### Live path (not schema clone)

- Source of truth for ongoing Organic pay: GP-HRIS **Payroll register** + current PH rules.
- Port **keep** variables/behavior from the GREENHRISMAIN harvest; do not clone tables/procs as the product model, and do not treat encoded totals as truth ([0009](./0009-greenhrismain-is-catalog.md)).
- **No billing twin** for Organic / house staff.

### Dual-run until exit

- Keep **Office payroll** (weekly `weekly_attendance` → payslips) in parallel with the cutoff register until exit.
- Exit weekly write path after **two consecutive** Organic cutoffs **finished entirely in GP** (Payroll register posted, remittance + bank files) with written sign-off from **Admin Mike Razal** and **Account Manager Michelle Razal**. GREENHRISMAIN amount-equality is **not** required ([0009](./0009-greenhrismain-is-catalog.md)).
- During dual-run, keep open loans honest in GP (`employee_loans`); do not dual-write to SQL Server just to force a match. After exit, GP-HRIS `employee_loans` is SoT.

### Sample match (diagnostic, not the exit)

- Golden month: **July 2026** (Organic / GREEN PASTURE PEOPLE MANAGEMENT INC.) — diagnostic corpus, not a pass/fail gate.
- Periods:
  - **2026-07-01 → 2026-07-15** — `e781658c-cfda-4a12-bf32-063011ef3fb3`
  - **2026-07-16 → 2026-07-31** — `35f279c1-e163-4f13-bcd8-460469c8758e` (primary closed golden)
- Replay script: `npx tsx scripts/organic-july-sample-match.ts` (GREENHRISMAIN via `SQL_*`; `--skip-legacy` for GP-only).
- Line-level: all active bundy staff — gross, statutory, loans, net. Classify mismatches as **encoding fault** vs **GP missing a variable**.
- Statutory: coded helpers first; contribution tables only if current PH rules need them.
- Named owners still sign **current PH rules** vs a missing GP variable — not “clone stale legacy output.”

### Payroll history import (continuity, not the live path)

- Import **current-year YTD** + **open loan balances/schedules** so remittance / alphalist / ongoing deductions work without SQL Server.
- Multi-year register history only if Finance still needs it inside GP (not Excel/exports).
- Distinct from Directory people ETL.

### After Organic cutover

- GP-HRIS is the only place Organic encodes hours adjustments, loans, deductions, and generates remittance/bank files.
- GREENHRISMAIN remains readable only as long as needed for sample match / extract; Organic ops do not use it going forward.

## Consequences

- Cutover is blocked on two consecutive GP-complete Organic cutoffs + written sign-off, not on amount-match and not on “all GREENHRISMAIN tables in Supabase.”
- Deployed gradual enrollment is a later program; ADR 0005 still governs “no mass bundy” until a client is deliberately enrolled.
- Glossary: see root `CONTEXT.md` — Organic cutover, Sample match, Payroll history import, Deployed gradual enrollment.

## Out of scope (this ADR)

- Deployed client billing twin / CSM billing.
- Mass recode of live employee IDs / portal passwords.
- Cloning GREENHRISMAIN EXEC procedures as the runtime.
