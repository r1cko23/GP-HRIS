# Organic payroll E2E (cutoff hub)

Organic / GP house path: **bundy → cutoff_hours → payroll register → exports**.

Weekly `weekly_attendance` → `lib/ph-payroll` payslips remain available until **Organic cutover** (see [ADR 0007](../adr/0007-organic-cutover.md)).

## Cutover bar (settled)

- Dual-run weekly payslips + cutoff register; exit weekly writes after **two consecutive** Organic cutoffs **finished entirely in GP** (register posted, remittance + bank files) with Mike + Michelle sign-off. See [ADR 0009](../adr/0009-greenhrismain-is-catalog.md).
- GREENHRISMAIN amount-compare is **diagnostic** (encoding fault vs missing GP variable), not the pass/fail gate. Golden corpus: **July 2026** — `2026-07-01…15` and `2026-07-16…31`.
- History import: current-year YTD + open loans; multi-year only if Finance still needs it in GP.
- No Organic billing twin. Deployed later: same shape, **one client at a time**.
- Variable harvest (keep / drop / already): [PAY_SPINE_HARVEST.md](../legacy-greenhrismain/PAY_SPINE_HARVEST.md).

### July 2026 dual-run (created)

| Kinsena | `cutoff_periods.id` | GP draft register (lines / gross / net) |
|---|---|---|
| 1–15 | `e781658c-cfda-4a12-bf32-063011ef3fb3` | 49 / ₱447,397 / ₱377,471 |
| 16–31 | `35f279c1-e163-4f13-bcd8-460469c8758e` | 47 / ₱491,990 / ₱438,059 |

Replay + compare:

```bash
npx tsx scripts/organic-july-sample-match.ts          # needs GREENHRISMAIN (SQL_*) on VPN
npx tsx scripts/organic-july-sample-match.ts --skip-legacy
```

CSVs land in `tmp/sample-match/`. Legacy compare needs reachability to `SQL_HOST` (currently fails off-VPN).

## UI

- **Operations → Payroll** (`/payroll`) — list/create cutoff periods (Organic house client only)
- **Payroll cutoff hub** (`/payroll/[id]`) — aggregate attendance, audit/approve, edit hours, build/post register, downloads (individual payslip PDFs, payroll summary PDF, remittance/bank CSVs)
- Legacy bookmarks: `/cutoff-periods` → `/payroll`, `/cutoff-periods/[id]` → `/payroll/[id]`
- Dual-run weekly Office path (interim): `/payroll-office` (not in sidebar)

## APIs

| Action | Route |
|---|---|
| List/create periods | `GET/POST /api/timekeeping/cutoff-periods` |
| Detail + hours | `GET/PATCH /api/timekeeping/cutoff-periods/[id]` |
| Aggregate bundy | `POST .../aggregate-from-office` |
| Edit hours (draft) | `PATCH .../hours/[hoursId]` |
| Build/view register | `POST/GET .../payroll-run` |
| Post (loans + posted) | `POST .../payroll-run/post` |
| Exports | `GET .../exports?type=payslips\|sss\|philhealth\|pagibig\|wtax\|bank\|other_deductions\|summary-pdf\|payslip-pdf\|payslip-pdfs-zip` |

## Formulas

[`lib/ph-payroll`](../../lib/ph-payroll/index.ts) — Statutory + Premiums (`PREMIUM_RATES`); register `buildRegisterLine` and weekly payslips compose them. Loans via `sumLoansForCutoff`.

## Schema

Migration `213_organic_payroll_register.sql`: `payroll_register_runs`, `payroll_register_lines`, `payroll_register_loan_posts`, `cutoff_hours_audit`.
