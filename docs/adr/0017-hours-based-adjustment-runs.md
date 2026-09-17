# Hours-based Adjustment runs after posted payroll

Posted regular cutoffs stay immutable. Person/hours corrections after Post are a separate **Adjustment run** (hours verified in GP-Client, then ingested) — not peso catch-up folded into the next regular kinsena, and not void/rebuild of the posted register.

## Status

Accepted — product confirm 2026-09-17.

## Context

[ADR 0012](./0012-next-cutoff-catchup.md) chose next-cutoff **peso** catch-up for Organic cutover speed. Ops need missed people and hours **verified** in GP-Client (same gate as regular DTR), a **separate report**, and payout on the **nearest** payroll date — without inflating the next regular cutoff’s basic/OT. Legacy MAIN had `payrolladjustmenttbl` + separate payslip/receiving reports (peso `receiveamount`). Cleaner shape: hours matrix → same premium engine → distinct Adjustment register.

## Decision

1. **Posted regular history never changes amounts.** Downloads stay on the posted regular cutoff.
2. **Adjustment cutoff** = `cutoff_periods` row with `period_kind = 'adjustment'`, `source_cutoff_period_id` pointing at the posted regular cutoff, same Client/Branch, period dates matching the source (or the work being corrected), `payroll_date` = nearest payout.
3. **Hours SoT:** GP-Client Period (adjustment / reopen flow) → Validate → ingest into the **open Adjustment** cutoff. Never re-ingest into a posted **regular** cutoff (409).
4. **Build/Post** the Adjustment register with the same Organic compute path. Exports are titled **Payroll Adjustment** and are separate from the next regular summary.
5. **Peso catch-up is removed.** UI and write API are gone; table `payroll_catchup_corrections` may retain historical rows only.
6. **Out of scope for v1:** void of posted regulars, auto statutory on naked pesos, billing SOA prior-period line (follow-on).

## Consequences

- Unique key on cutoffs includes `period_kind` so an adjustment can share dates with its source.
- Payroll list and hub chrome distinguish regular vs adjustment.
- [ADR 0012](./0012-next-cutoff-catchup.md) is **superseded**.
