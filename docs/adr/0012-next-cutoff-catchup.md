# Next-cutoff catch-up for posted payroll

Posted Organic cutoffs stay immutable. After post, money corrections are **catch-up corrections** queued against a later open Cutoff period for the same Client — not an off-cycle adjustment run, and not void/rebuild of the posted register.

## Status

Accepted — product confirm 2026-09-01.

## Context

Organic post is terminal (`posted` has no status transitions). Ops still discover under/over pay after bank/remittance files leave. Alternatives considered: separate adjustment run (legacy `payrolladjustmenttbl` shape) and void+rebuild (only safe if unpaid). We chose next-cutoff catch-up for Organic cadence and cutover simplicity.

## Decision

1. **Posted history never changes amounts.** Downloads stay on the posted cutoff; corrections do not rebuild it.
2. **Catch-up correction** = signed peso line (`amount`, `reason`) tied to a **source** posted cutoff and an **apply** open cutoff (draft / pending_audit / approved) on the same Client.
3. On **Build register** for the apply cutoff, pending catch-up amounts fold into `earnings.adjustment` and gross/net. On **Post**, those rows become `applied`.
4. **v1 statutory:** catch-up does **not** recompute SSS / PhilHealth / Pag-IBIG / WTax. Corrections that need statutory treatment are encoded as hours (or a later enhancement), not silent tax recomputation on a peso line.
5. **Out of scope for this ADR:** off-cycle adjustment runs, void of posted registers, Office weekly `adjustment_amount`, multi-particular legacy `incomeadjustment*`.

## Consequences

- UI on a posted cutoff queues catch-up toward the next open period (ops must open the next cutoff if none exists).
- Register summary **Adjustment** column is live (`earnings.adjustment`), not a stub zero.
- YTD / alphalist readers must treat catch-up as pay on the **apply** cutoff date, with audit pointing at the source cutoff.
