# Approved Work, Pay, and Bill are separate immutable ledgers

## Status

Accepted — 2026-10-07. **Amends, but does not delete or supersede, [0015](./0015-client-billing-in-gp-hris.md).** Billing remains in GP-HRIS and operationally follows payroll controls, but it is built from Approved Work rather than from posted Pay lines.

## Context

[0015](./0015-client-billing-in-gp-hris.md) made Client billing a second money run on the posted payroll register. That correctly placed billing in GP-HRIS and prevented a CSM billing clone, but it couples two financial purposes:

- workers are paid from pay rates, statutory rules, deductions, and employee identity;
- Clients are billed from contract rates, billable allowances/employer costs, fees, VAT, and EWT.

Both depend on the same approved hours and assignment, but a valid contractual difference must not require changing worker pay, and a pay correction must not silently change an issued Client bill. Using one posted ledger as the input to the other obscures lineage and makes independent adjustment difficult.

## Decision

1. **Approved Work Ledger** is the immutable, revisioned operational fact accepted from GP-Client validation (or Organic approval). Its line grain is Person + Employment + Placement + Position + work period/cutoff assignment, with the premium-hour matrix, approved allowances, source revision, approver, and approval time.
2. A correction before financial posting supersedes an Approved Work revision without deleting it. A correction after posting is separate adjustment Approved Work linked to the original.
3. **Pay Ledger** is built in GP-HRIS from Approved Work plus snapshotted pay rates, statutory policy, deductions/loans, and calculation versions. Posting makes its lines and totals immutable.
4. **Bill Ledger** is built in GP-HRIS from the same Approved Work plus snapshotted billing rates, billable employer costs, Client fee rules, VAT, EWT, and calculation versions. It does not read Pay Ledger amounts as source facts.
5. Pay and Bill lines each store `approved_work_line_id` and their own run/line IDs, input snapshots, calculation version, currency, and correlation ID. A reason code explains intentional pay-versus-bill hour or amount treatment.
6. Finance may require the Pay run to pass/post before releasing the Bill run as an operational control. This ordering does not make Pay the Bill data source.
7. Posted Pay and Bill Ledgers are independently immutable. Pay corrections use an Adjustment Pay run ([0017](./0017-hours-based-adjustment-runs.md)); bill corrections use a separate debit/credit Bill adjustment. Neither rewrites the other or the original Approved Work.
8. Organic Approved Work produces Pay only. It has no Bill Ledger unless a future ADR explicitly introduces Organic billing.

## Consequences

- Every paid and billed amount has direct lineage to Approved Work and the applicable rate/policy snapshot.
- Payroll and billing can differ for legitimate contractual reasons without corrupting hours or copying Pay lines.
- Posting or adjusting one ledger does not mutate the other.
- Draft Pay and Bill runs can build in parallel, while release controls may still sequence them.
- Reconciliation compares Approved Work → Pay and Approved Work → Bill separately, then explains cross-ledger differences.
- GP-HRIS needs distinct ledger IDs, statuses, snapshots, adjustments, exports, access grants, and accounting controls.
- [0015](./0015-client-billing-in-gp-hris.md) remains authoritative for ownership (GP-HRIS), Deployed-only scope, fees/taxes, and SOA/debit-memo outputs; only its “posted payroll register is the billing input” clause is amended.
