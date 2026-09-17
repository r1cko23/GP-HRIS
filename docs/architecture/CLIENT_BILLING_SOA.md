# Client SOA and debit-memo outputs

Billing numbers are already computed on a **posted payroll register** ([ADR 0015](../adr/0015-client-billing-in-gp-hris.md)). This spec is the next layer: **files Finance sends the Client**, keyed per Client — not a second money engine.

Organic / house has no billing twin. These outputs exist only for Deployed Clients.

## What MAIN did

GREENHRISMAIN `BILLINGPROCESSNEW` filled `BILLINGTABLE`. Separate procs wrote Excel packs:

| Pack | Body | Header | Expense |
|---|---|---|---|
| ALDEX | `BILLINGGENERATETEMPLATE1ALDEX` | `…headerALDEX` | `…expenseALDEX` |
| GENERIC | `BILLINGGENERATETEMPLATE1GENERIC` | `…headerGENERIC` | `…expenseGENERIC` |
| PLK | `BILLINGGENERATETEMPLATE1PLK` | `…headerPLK` | `…expensePLK` |

GENERIC’s body is hours × **billing** rates (Reg / OT / ND / LH / SH …) plus other deduction / adjustment columns. Header and expense sheets are Client letterhead and pass-through costs.

There is **no** MAIN procedure named debit memo. In operations, the debit memo is the Client invoice: billed labor + mandatories + admin fee ± VAT/EWT, often the same totals as the SOA wrap.

## GP source of truth

One processed `billing_runs` row + `billing_lines`. Do not recompute hours or rates in the template. Read:

- Line grain: hours buckets, `billing_daily_rate`, labor, mandatories
- Run wrap: `totals.labor`, `mandatories`, `admin_fee_*`, `vat_*`, `ewt_*`, `amount_due`
- Client: name, site label, `admin_fee` / `vat` / `ewt`
- Person: Directory code, name, position

Cancel billing unmarks the run; posted payroll stays immutable ([ADR 0012](../adr/0012-next-cutoff-catchup.md)). Regenerating a file after cancel is forbidden until Process billing runs again.

## Per-Client tailoring

Store the pack on the Directory **Client** (not hardcoded by name in the exporter):

| Field | Values | Default |
|---|---|---|
| `billing_output_pack` | `generic` · `aldex` · `plk` · `debit_memo` | `generic` |

Nabati uses GENERIC-shaped hours × billing rate + the existing wrap (5.5% / 12% / 10%). PLK/ALDEX keep their column sets. `debit_memo` is a one-page invoice: Client, cutoff, headcount, labor, mandatories, admin fee, VAT, EWT, **amount due**, billing reference.

Ops pick the pack on the Client card (People → Client). Payroll hub **Download SOA** / **Download debit memo** after Process billing uses that pack. Switching pack does not change stored billing amounts.

## Files to generate (v1)

1. **SOA workbook** — pack from `billing_output_pack` (`generic` / `aldex` / `plk`): **Header** (letterhead + fee rates + amount due), **Body** from `billing_lines`, **Expense** (pass-through particular/amount from `billing_runs.fees.expenses`, empty when none), **Wrap** totals.
2. **Debit memo** — PDF. Same wrap totals. Billing reference is the memo number (`BILL-YYYY-MM-DD-YYYY-MM-DD` until Client numbering is specified).

Do not EXEC MAIN. Port column maps in `lib/client-billing/` next to `wrapBillingSoa`. Tests: one Nabati GENERIC line (hours × ₱600 billing daily) and wrap; one debit-memo total equal to `amount_due`; Header Date covered + Expense rows when provided.

## Out of scope for v1

- Recreating 401-column `BILLINGTABLE`
- Per-department split beyond Directory position / branch already on the line
- Emailing the Client
- Editing amounts in the template (change Directory rates, then rebuild billing)

## Hub

Cutoff hub (`/payroll/[id]`) after a processed billing run: labor / mandatories / admin / amount-due cards, plus **Download SOA** (xlsx from `billing_output_pack`) and **Download debit memo** (PDF of wrap totals). Benefits → Loans stays the loan file; it is not an SOA screen.

Shipped: Header (Prepared/Noted by) + pack-specific Body — GENERIC Hours×Amount; **ALDEX/PLK MAIN Rate×Hours** (GP buckets mapped, missing combo hours = 0) + Expense + Wrap. Debit memo landscape PDF with GP logo. Expense rows editable on the hub. Funding memo (ATM/Cheque/GCash) is a separate cutoff download, not SOA. Annual SIL / 13th-month / alphalist xlsx: `/api/reports/finance-exports` and Reporting → BIR.
