# Organic cutoff report pack (GREENHRISMAIN)

Live read 2026-09-01 from `GPSQLSERVER01\GPSQLEXPRESS` / `GREENHRISMAIN`, client **173** (GREEN PASTURE PEOPLE MANAGEMENT INC.). Do not EXEC these procedures as the GP runtime ([ADR 0003](../adr/0003-clock-does-not-call-greenhrismain.md), [0009](../adr/0009-greenhrismain-is-catalog.md)). Port **file contents**, not Crystal.

Client calendar on this row: Cut1 1–15, Cut2 16–30, `schedstatutory` Monthly, `wtaxsched` Semi-Monthly — same as Directory Client `16556bfe-…`.

Organic has **0** `tbl_timekeep` rows. House hours live on `payroll_summary`. Skip `sp_tkreport` / `sp_tksummaryreport` for this Client.

## Every posted cutoff

| File | Legacy source | Keys Finance needs |
|---|---|---|
| Payslips | `sp_payslipmain` / `sp_payslipmainIND` / `SP_payslipind` | One PDF per person; receiving copy is a print variant |
| Register summary | `usp_PayrollSummary_List*` + Crystal `42bf00bd-*` | Hours × rates, statutory, loans, net |
| WTAX remittance | `USP_WTAX` / view `forwtax` | TIN, Wtax, gross taxable. Jul 1–15: 54 rows, 1 missing TIN |
| Bank / ATM upload | `SPbankreportall` | Name, `payrollatmno`, net, `payrollpaytype`. Aug 1–15: 53/53 ATM, 0 cheque / GCash / xfer |
| Other deductions | `SPlistofdeduction` | `otherdeduction.particular`. Jul 16 window: Cash Advance, Pag-IBIG Loan, SSS Loan |

## Second window only (Monthly statutory)

`USP_SSS` / `USP_philhealth` / `USP_pagibig` take **payroll month**, not cutoff dates. First kinsena SSS/PH/Pag-IBIG amounts are 0 on every 2026 Organic 1–15. Second window carries EE + ER (SSS also ECC + WISP `pro`).

| File | View / proc | Must include |
|---|---|---|
| SSS | `FORSSS` / `USP_SSS` | SSSno, EE, ER, ECC, WISP EE/ER |
| PhilHealth | `FORPHILHEALTH` / `USP_philhealth` | philhealthno, EE, ER |
| Pag-IBIG | `FORPAGIBIG` / `USP_pagibig` | pagibigno, EE, ER |

July 2026 second window was encoded as two `payroll_summary` date ranges (16–24 and 25–31) with the same `payrolldate` 2026-08-05. Remittance still groups as `payrollmonth = 'July 2026'`.

## Not per cutoff (Organic)

| File | When |
|---|---|
| Alphalist / 1601 | Year (`USP_FORALPHALIST`) |
| 13th month | Annual (`forpayslipreport` reads `thirteenmonth`) |
| SIL monthly | Accrual Excel |
| Billing invoice | Not this Client |
| DTR Excel (`sp_tkreport`) | Deployed `tbl_timekeep` only |

## GP-HRIS downloads today vs this pack

GP `/api/timekeeping/cutoff-periods/[id]/exports`:

| File | Status |
|---|---|
| Payslips PDF/ZIP + roster CSV | Yes — roster includes COLA/SEA/CTPA rates + billing estimate columns |
| Register detail CSV | Yes — per-day rates, allowance payroll (when Client flags on), billing gross estimate |
| Register summary PDF | Yes |
| WTAX CSV | TIN + taxable income from Directory |
| ATM bank CSV | Directory `bank_account_no` as `atm_no`, `pay_type` ATM when present |
| Other deductions CSV | `loan_lines.particular` + leftover loans / other |
| SSS / PhilHealth / Pag-IBIG | EE + ER (+ WISP on SSS). **Held on first kinsena** when Client statutory is Monthly. Pag-IBIG uses HDMF Circular 460 (tiered, ₱10k MFS cap). |

### COLA / SEA / CTPA / billing (GP behavior)

| Column | Source | In payroll gross? | In exports? |
|---|---|---|---|
| `cola_per_day` / `cola_payroll` | Employee `ecola` or position `ecola`; payroll amount when Client `include_cola` | No (yet) | Register detail + payslip roster CSV |
| `sea_per_day` / `sea_payroll` | Position `sea`; amount when `include_sea` | No | Same |
| `ctpa_per_day` / `ctpa_payroll` | Position `ctpa`; amount when `include_ctpa` | No | Same |
| `billing_daily_rate` / `billing_gross_estimate` | Employee or position billing rate × days | No — billing twin is not Organic payroll | Register detail + payslip roster CSV |

Organic house Client has `include_cola`, `include_sea`, `include_ctpa` **off**, so allowance payroll columns export as **0** even when per-day rates exist on file.
