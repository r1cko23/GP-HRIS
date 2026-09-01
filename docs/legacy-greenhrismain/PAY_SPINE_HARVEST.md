# Organic pay spine harvest

GREENHRISMAIN **variables and relationships** for Organic / GP house pay. Amounts in `payroll_summary` are **not** an oracle ([ADR 0009](../adr/0009-greenhrismain-is-catalog.md)).

Dump date: 2026-08-25 (`columns.json`, `procedures/*.sql`). Scope is Q3 A only — not billing, not 201, not 13th-month / alphalist / ATM (those are **later** / history import).

Correct keep/drop rows after review; C4 ports **keep** only.

## Rubric

| Verdict | Meaning |
|---|---|
| **already** | Equivalent on `cutoff_hours`, register `hours` / `earnings` / `deductions` JSON, `employee_loans`, or `lib/ph-payroll` statutory helpers |
| **keep** | Organic pay still needs it; port in C4 (Statutory + Premiums compose) |
| **drop** | Billing twin, Crystal/RDLC, `payroll_summary2` pivot, `uname`/`guid`, dated proc copies, UI chrome |
| **diagnostic** | July CSV columns: classify encoding fault vs missing GP variable — not a cutover veto |
| **later** | `thirteenmonth`, SIL YTD, alphalist, ATM — Payroll history import |

## Relationships

```
cuttoff (datestart, dateend, payoutdate)
    │
    ▼
tbl_timekeep          1 row per person per cutoff (hours + rate snapshot)
    │ idtimekeep
    ▼
payroll_summary       1 row per person per cutoff (earnings + statutory + net)
    │ idpayrollsum
    ├──────────────► otherdeduction  (loans + vale + uniform… via class)
    ├──────────────► adjustment / adjustmentnew
    └──────────────► OTCHART         (OT type × hours × amount; often empty)

loan 1──* loanschedule ──► otherdeduction (USPLoanprocesstopayroll)

SSS / Philhealth / pagibigtable / TAX*
    read by USP_SSS, USP_philhealth, USP_pagibig, USP_WTAX
    written onto payroll_summary contribution* / Wtax
```

GP map: `cuttoff` → `cutoff_periods`; `tbl_timekeep` → `cutoff_hours`; `payroll_summary` → `payroll_register_lines` (JSON hours/earnings/deductions, **not** 297 columns); `loan` → `employee_loans`.

## `cuttoff` (4) — already

| Column | GP |
|---|---|
| `datestart` / `dateend` | `cutoff_periods.period_start` / `period_end` |
| `payoutdate` | `cutoff_periods.payroll_date` |
| `payrollyear` | derived from period dates |

## `tbl_timekeep` (121)

Hours grain already lives on `cutoff_hours` (migration 208), including LH/SH/RD/WDO OT and ND combos GP named explicitly.

### already — hours → `cutoff_hours`

`actualregularhours`, `noofhourswork`, `Overtime_Hours`, `Nightdiff_Hours`, `regularnightshiftOT_hours`, `LegalHoliday_*`, `lhotndh`, `Holiday_Special_*`, `shotndh`, `rdhours`, `RDothours`, `rdndhours`, `rdotndh` / `rdotndhours`, `lhwdohours`, `lhwdoothours`, `lhrdothours`, `shwdohours`, `shwdoothours`, `shrdothours`, `WDOhours`, `tardiness`, `undertime`, `absences`, `pto`, `allowance`.

Keys / names: `idtimekeep` → `legacy_idtimekeep`; `employeeid`, names, `idclient`, dates, `idposition`, `idclientbranch`, `departmentcode`, `dailyrate_payroll`, `tkstatus`, `sourceofdata`, `remarks`.

Bank / basis: `paythrough`, `bankaccountno`, `bankname`, `sssbasis`, `phibasis`, `schedsss`, `fixrate`, `frequencypaymenttk`.

### already — multipliers → `PREMIUM_RATES` / `rate_snapshot`

All `*rate` columns (`regrate` … `shrdotrate`, `uhrate`, `lh2rate`, `sh2rate`). Do not store 30 rate columns per row; keep one daily rate + the premium table.

### keep — missing hour buckets / other income lines → **later** (not C4)

July 2026 Organic `cutoff_hours` (both kinsenas): non-zero only **regular, OT, ND, rest day**. LH/SH/WDO/PTO/tardy/combo hours are all 0. Do not add columns until a cutoff actually fills them.

| Column | Parked as |
|---|---|
| `lhwdondhours`, `lhwdootndhours`, `shwdondhours`, `shwdootndhours` | **later** |
| `LegalHoliday2_Hours`, `Holiday_Special2_Hours` | **later** |
| `food`, `uniformshortage`, `charges`, `UH`, `shortage`, `nameplate` | **later** |
| `incomeadjustment`, `allowancenb`, `incomeadjustmentnb` | **later** |

### drop

`downloaded`, `statusapprove`, `payrollmonthsort`, `billingstatus`, `approvedby`, `auditedby`, `dateapproved`, `dateaudited`, `createdby`, `createddate`, `updateby`, `lastupdate`. Audit on GP is `cutoff_hours_audit`.

### later

`thirteenmonthyear`.

### diagnostic

None at this grain. Hours faults show up as **gross** on the register compare.

## `payroll_summary` (297)

Do not clone this table. Register line = `hours` + `earnings` + `deductions` JSON + gross / net.

### already / diagnostic (July CSV)

These exist on `payroll_register_lines` (or loans JSON). Compare them only to classify faults:

`grossalary`, `contributionSSSEE`, `contributionphilhealthEE`, `contributionPagibigEE`, `Wtax`, `Salary_Loan`, `Pagibig_Loan`, `netamount`.

### already — identity, hours, earnings, posting

Person / cutoff: `idpayrollsum`, `Employee_id`, `Date_Start`, `Date_End`, `payrolldate`, `idclientp`, `idclientbranchp`, `idbranchpositionp`, `department_codep`, `idtimekeep`, names, `tinno`, `job_code`, `branch2`, `jobposition2`, `departmentdesc2`, `status2`, `payrollmonth`, `payrollyear`, `payrollpaytype`, `frequencypayment`, `posted`, `payrollstatus`, `datalocked`.

Hours / pay that `buildRegisterLine` already covers: regular / OT / ND / LH / SH / RD / WDO hours **and** peso columns in the first matrix (`Regular_*`, `Overtime_*`, `Nightdiff_*`, `LegalHoliday_*`, `Holiday_Special_*`, `RDhours`/`RD`, `WDOhours`/`WDO`, `lhotnd*`, `shotnd*`, `RDot*`, `rdnd*`, `lhwdohours`/`lhwdo`/`lhwdoot*`, `shwdohours`/`shwdo`/`shwdoot*`, tardiness, undertime, absences, pto, `basic`, `Totalsalary`, `TotalOT`, `Other_Deduction`, `Totaldeduction`, `dailyrate_payroll`, `allowancep`, `incomeadjustmentp`, `Adjustment` / `Adjustment2`, `payrollatmno` / `empbankname` / `empchequeno` / `empmoneyxfer*` / `gcashp` as bank).

Premium **rate** columns on the register row → `PREMIUM_RATES` (already), same as timekeep.

Leaves / SIL hours → leave overlay (already on weekly path; register uses `pto_hours`).

### keep — C4 shopping list (Organic live path)

July register lines only store EE statutory + loans + tax; earnings are basic / OT / ND / rest day / allowance. No `withsss` columns on Directory.

**This C4 slice**

- One **Premiums** table (`PREMIUM_RATES`) consumed by register hours → earnings and by weekly day-type attendance
- One **Statutory** helper: EE SSS (incl. WISP split internally), PhilHealth, Pag-IBIG, WTax — same numbers as today for **net**
- Statutory **return type** also carries ER + ECC + WISP so remittance CSVs can stop inventing employer share later
- **Composer**: `buildRegisterLine` and payslip amounts call those two; no inline `calculateSSS` in `app/payslips/page.tsx`

**Not this slice (was keep; now later)**

- Extra hour buckets (July all zero) — see tbl_timekeep **later**
- `withsss` / `nodeduction` / basis flags — no GP column to honor yet
- ECOLA / SEA / CTPA / bonus / incentives / uniform / nameplate / `netamount2`
- `loanschedule` grain
- Changing Pag-IBIG from legacy MAIN flat EE-only rows — GP now uses Circular 460 (may differ from July MAIN parity on low salaries)

**Still keep for remittance (types only this slice)**

- `contributionSSSER`, `contributionSSSECC`, `contributionSSSEEpro`, `contributionSSSERpro`
- `contributionPagibigER`, `contributionphilhealthER`

### drop — billing twin + chrome (~65)

Every `*_bill` / `*billing` / `dailyrate_billing` / `databillingstatus` / `transfertoforbilling*`. Grid chrome: `Unique`, `Earnings`, `Deduction` (nvarchar section headers), `logo`, signatory columns, email-send columns, `sheetnamenew`, `groupnamenew`, `dupstag`, `proofread`, `payrolltemp`, `departmentidtemp`, `pcreated*` / `pupdate*` / `plastupdate`, `companyname2`.

`payroll_summary2` (29 cols) is the **pivot** of this table for the WinForms grid (`payrollsummaryprocess*`). **drop** as a product table; do not port.

### later — history import

`thirteenmonth`, `thirteenmonthyear`, `ytdthirteenmonth`, `postedthirteen`, `ytdstart`, `ytdend`, `silp`, `silpytd`, `silpaid`.

## Loans

| Legacy | Verdict | GP |
|---|---|---|
| `loan` (amount, term, interest, status, particular) | **already** (header) | `employee_loans` |
| `loanschedule` (datefrom/dateto, Amount, Amountpaid, balance, `idpayrollsum`) | **keep** | GP has remaining terms, not a per-cutoff schedule table. Needed so posting does not rely on “monthly/2” only |
| `otherdeduction` + `otherdeductionclass` | **keep** (class) / **already** (loan amounts on register) | Class maps particular → payslip vs billing; billing exclude = **drop**. Vale / uniform / nameplate types = **keep** |
| `USPLoanprocesstopayroll`, `sp_tkloanprocess` | **useful** (behavior) | `sumLoansForCutoff` + `payroll_register_loan_posts` |

`sssloantemp` / `pagibigloantemp` on the register = **drop** (scratch).

## Statutory tables

| Table | Verdict |
|---|---|
| `SSS` (bracket, Range/Range2, EE/ER, ECC, `eepro`/`erpro`) | **keep** as reference data **if** coded helpers disagree with current SSS (WISP + ECC). `SSSold` / `SSSEmployerecom` = **drop** (superseded copies) |
| `Philhealth` / `Philhealth_2018` | **keep** 2018+ percentage row as reference; old peso brackets **drop** if unused |
| `pagibigtable` | **keep** (EE+ER amounts) — GP uses HDMF Circular 460 tiering in `lib/ph-payroll/contributions.ts` |
| `TAXTABLENEW` (Range, PrescribeTax, Percentage, Term) | **keep** as BIR reference vs `getWithholdingTaxBreakdown` |
| `TAX`, `TAX_2018`, `TAX_MONTHLY`, `TAX_SEMIMONTHLY`, `TAX_EXEMPTION_2018` | **drop** (pre-TRAIN / unused duplicates) unless a keeper row is cited in `USP_WTAX` |

Do not replace current PH helpers with table lookups until a diagnostic class says the helper is wrong.

## `OTCHART`

6 columns: `idpayrollsum`, `ottype`, `noofhours`, `amount`, `uname`. **drop** as a table (hours already on `tbl_timekeep` / `cutoff_hours`). `uname` = chrome.

## `adjustment` / `adjustmentnew`

Line items by particular + taxable flag → register `earnings.allowance` / other. **already** as a single allowance/adjustment number; **keep** the *particular* breakdown if Organic encodes more than one adjustment per cutoff (`adjustmentnew.adjustmentstatus` = workflow chrome → **drop**).

## Procedures

GREENHRISMAIN has **0** user-defined functions. Logic is 219 stored procedures. **Do not EXEC** these as the GP runtime.

### useful — read for C4, then delete the T-SQL from the path

| Proc | What to steal |
|---|---|
| `USP_SSS`, `SSS15TH` | MSC bracket, EE/ER/ECC, WISP (`pro`), 15th vs end-of-month split, `withsss` |
| `USP_philhealth` | EE/ER, basis (`philhealthbasis`) |
| `USP_pagibig` | EE/ER vs `pagibigtable` |
| `USP_WTAX` | taxable = gross − statutory, semi-monthly table, `nodeduction` / `withtax` |
| `USPLoanprocesstopayroll`, `sp_tkloanprocess`, `updateotherdeductiontoPS` | schedule → deduction line → register |
| `sp_tkapprovedfinal` | DTR approved → payroll row (GP: aggregate + approve + `buildRegisterLine`) |
| `SPupdateprocessmandatory` | when SSS/PHI/Pag-IBIG are recomputed after hours edit |
| `USP_Payrollposting` | post = lock + archive; GP already posts loans + `payroll_register_runs.status` |

### report-only — do not port

Crystal/RDLC GUID family `42bf00bd-*` (15-day vs 30-day, mass vs IND, SSS/PHI/Pag-IBIG/WTAX variants). `sp_payslip*`, `forpayslip*`, `usp_PayrollSummary_List*`, `payrollselect*`, dashboards, email-ready flags.

### pivot / UI — do not port

`payrollsummaryprocess` and dated copies (`payrollsummaryprocess8-18-2025`, `*_old`, `*_new_with_error`). They unpivot `payroll_summary` into `payroll_summary2` Headername rows.

### do-not-port

`BILLING*`, `billing-*`, picture, backup, 13th-month procs, SIL Excel, user maintenance.

## C4 next (from this map)

1. **Premiums** — one multiplier table in `lib/ph-payroll`; weekly `PAYROLL_MULTIPLIERS` becomes an adapter. No new `cutoff_hours` columns (July unused).
2. **Statutory** — fold `utils/ph-deductions` behind `lib/ph-payroll`; EE net unchanged; return ER/ECC/WISP for remittance.
3. **Composer** — `buildRegisterLine` + payslip amounts; delete inline SSS on the payslip page. No 297-column clone.

## Out of this harvest

`BILLINGTABLE`, 201 child tables, `TIME_KEEPING` daily punches (GP Clock already), `payrollhistory.payroll_history` (archive clone of the register), `thirteenmonth`, `ATM` / `alphalist`.
