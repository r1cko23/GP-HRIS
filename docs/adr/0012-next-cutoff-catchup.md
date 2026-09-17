# Next-cutoff catch-up for posted payroll

Posted Organic cutoffs stay immutable. After post, money corrections were **catch-up corrections** queued against a later open Cutoff period for the same Client — not an off-cycle adjustment run, and not void/rebuild of the posted register.

## Status

**Superseded** by [0017](./0017-hours-based-adjustment-runs.md) (2026-09-17). Peso catch-up UI and write API are removed; after Post use hours-based Adjustment runs. Table `payroll_catchup_corrections` may retain historical rows.

## Context

Organic post is terminal (`posted` has no status transitions). Ops still discover under/over pay after bank/remittance files leave. Alternatives considered: separate adjustment run (legacy `payrolladjustmenttbl` shape) and void+rebuild (only safe if unpaid). We chose next-cutoff catch-up for Organic cadence and cutover simplicity — later replaced by hours Adjustment runs for person/hours.

## Decision (historical)

1. **Posted history never changes amounts.** Downloads stay on the posted cutoff; corrections do not rebuild it.
2. **Catch-up correction** = signed peso line (`amount`, `reason`) tied to a **source** posted cutoff and an **apply** open cutoff (draft / pending_audit / approved) on the same Client.
3. On **Build register** for the apply cutoff, pending catch-up amounts fold into `earnings.adjustment` and gross/net. On **Post**, those rows become `applied`.
4. **v1 statutory:** catch-up does **not** recompute SSS / PhilHealth / Pag-IBIG / WTax. Corrections that need statutory treatment are encoded as hours (or a later enhancement), not silent tax recomputation on a peso line.
5. **Out of scope for this ADR:** off-cycle adjustment runs, void of posted registers, Office weekly `adjustment_amount`, multi-particular legacy `incomeadjustment*`.

## Consequences

- Replaced by Adjustment cutoffs ([0017](./0017-hours-based-adjustment-runs.md)).
- Register summary **Adjustment** column may still appear from hours-derived earnings; it is no longer fed by peso catch-up queue.
