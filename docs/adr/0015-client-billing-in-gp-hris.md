# Client billing is in GP-HRIS after posted payroll

Deployed client billing is a second money run on the **posted payroll register** in this app, not a CSM module and not a clone of `BILLINGTABLE`. GREENHRISMAIN `BILLINGPROCESSNEW` copies locked `payroll_summary` hours and multiplies by **billing** rates, then stamps Client admin fee / VAT / EWT for the SOA. GP does the same grain: hours × Directory `billing_daily_rate` (DOLE premiums from the payroll table) + employer mandatories bill-back + Client fee wrap.

Organic / house staff still have **no** billing twin ([0007](./0007-organic-cutover.md)): a register with no billing daily rates cannot be billed.

Cancel unmarks the billing run only. The posted register stays immutable ([0012](./0012-next-cutoff-catchup.md)). After Process billing, the cutoff hub downloads SOA Excel and a debit-memo PDF from stored `billing_runs` / `billing_lines` ([CLIENT_BILLING_SOA.md](../architecture/CLIENT_BILLING_SOA.md)). Pack is `directory.clients.billing_output_pack`.

## Status

Accepted — 2026-09-05. Amends “billing later in CSM” in architecture-essentials and the Deployed billing out-of-scope clause of [0007](./0007-organic-cutover.md).
