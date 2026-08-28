# GREENHRISMAIN → GP-HRIS gap map

Connected 2026-08-25 from this Mac (`10.0.0.243`) to SQL Server at **`10.0.0.167:1433`** (`GPSQLSERVER01`). Target catalog: **GREENHRISMAIN**.

There are **no user-defined SQL functions** in GREENHRISMAIN. Business logic lives in **219 stored procedures**.

Full dumps (do not commit credentials; this folder has schema only):

- `GREENHRISMAIN-catalog.json` — tables, views, procedure names, row counts
- `columns.json` — every column
- `procedures/*.sql` — procedure bodies
- `all-databases.json` — other catalogs on the same instance

## Instance databases

| Database | Tables | Views | Procedures | Role |
|---|---:|---:|---:|---|
| **GREENHRISMAIN** | 98 | 20 | 219 | Live HRIS / payroll / billing |
| GREENHRISTEST | 94 | 19 | 174 | Staging copy of main |
| **payrollhistory** | 4 | 0 | 3 | Archive: `payroll_history` ~408k rows |
| **PICTUREDB** | 1 | 0 | 2 | Employee photos (`tblpicture` 1,076) |
| MANDATORYTABLEHISTORY | 2 | 0 | 0 | SSS contribution table snapshots |
| DWConfiguration / DWDiagnostics / DWQueue | — | — | — | SQL Server PolyBase/DW system DBs — ignore |

## What GP-HRIS already covers (partial)

| Legacy | GP-HRIS today | Gap |
|---|---|---|
| `Employee` (132 cols, ~29k rows) | `employees` (~99 rows, operational subset) | 201-file, government IDs, client/branch/position, verification, barred, rates, bank/GCash |
| `loan` + `loanschedule` | `employee_loans` | Amortization schedule, interest, SSS/Pag-IBIG loan types as first-class loans |
| `TIME_KEEPING` (daily IN/OUT) | `time_clock_entries` | Legacy is imported DTR; GP is live clock. No upload/audit/approval pipeline |
| `tbl_timekeep` (cutoff timekeeping, 121 cols) | `weekly_attendance` + payslip JSON | Missing premium-hour matrix (LH/SH/RD/WDO/ND OT combos) as stored columns |
| `payroll_summary` / `payroll_summary2` (~270k+394k rows, ~297 cols) | `payslips` (115 rows) + `payroll_runs` (empty) | Legacy is the real payroll register. GP payslips are not this engine |
| `otherdeduction` / `adjustment` | `employee_deductions` + cutoff allowances | Per-cutoff line items tied to a payroll run |
| `client` / `client_branch` / `client_branch_position` | `companies` (payroll-audit clients only) | Live client master, branches, positions, cutoff rules, statutory basis |
| `Department` | none | Client-scoped departments |
| `cuttoff` | implicit dates on payslips | Shared cutoff calendar |
| `thirteenmonth` | none | 13th-month compute + payout |
| `SSS` / `Philhealth` / `TAX*` / `pagibigtable` | amounts on deductions/payslips | Official contribution tables + remittance files |
| `OTCHART` | `overtime_requests` | Request workflow exists; OT **pay chart** by type does not |
| `user_maintenance` / permissions | `users` + RBAC | Different model (Supabase vs local SQL logins) |
| `SIL` proc + accrual Excel | SIL on employees + leave requests | Accrual Excel import / monthly SIL report |
| Photos in PICTUREDB | profile pictures in storage | Separate picture database not used |

## Biggest missing domains in GP-HRIS

### 1. Payroll engine (highest)

Legacy `payroll_summary` is the production register: hours, premiums, billing vs payroll rates, SSS/PhilHealth/Pag-IBIG/WTAX, loans, other deductions, 13th month YTD, posting flags.

Key procedures:

- `payrollsummaryprocess` (+ dated copies)
- `USP_Payrollposting`
- `sp_payslipmain` / `sp_payslipmainIND` / `SP_payslipind`
- `SPupdatepayrollstatus`
- GUID-named procs (`42bf00bd-…`) — Crystal/RDLC report datasets for 15-day vs 30-day, mass vs individual, SSS/PHI/Pag-IBIG/WTAX variants

GP-HRIS `payslips` cannot replace this without a new register table shaped like `payroll_summary`.

### 2. Statutory contributions and BIR

Tables: `SSS`, `SSSold`, `SSSEmployerecom`, `Philhealth`, `Philhealth_2018`, `pagibigtable`, `TAX`, `TAX_2018`, `TAX_MONTHLY`, `TAX_SEMIMONTHLY`, `TAX_EXEMPTION_2018`, `alphalist`.

Views: `FORSSS`, `FORPHILHEALTH`, `FORPAGIBIG`, `forwtax`.

Procedures: `USP_SSS`, `USP_philhealth`, `USP_pagibig`, `USP_WTAX`, `USP_FORALPHALIST`, `SSS15TH`.

GP-HRIS stores contribution **amounts** but not contribution **tables**, employer share, ECC, or alphalist/1601 generation.

### 3. Timekeeping pipeline (not live clock)

`tbl_timekeep` is the cutoff DTR that payroll consumes. Procedures `sp_tk*`:

upload → validate → pending → audit → correction → approval → process other income/deduction/loan/uniform/nameplate → download.

GP-HRIS has clock-in and weekly attendance, not this import/audit/posting chain.

### 4. Client billing

`BILLINGTABLE` (401 columns, 15k rows), `billinggroup`, `billingadjustment`, `BILLINGEXPENSE`, bill templates.

Procedures: `BILLINGPROCESSNEW`, `billing-forbilling*`, `BILLINGGENERATETEMPLATE1*` (ALDEX / GENERIC / PLK).

No equivalent in GP-HRIS. This is client invoicing from the same hours, using **billing** rates (`dailyrate` vs `billingdailyrate`).

### 5. Employee 201 file

Child tables: `emp_contacts`, `emp_dependents`, `emp_education`, `emp_exam`, `emp_jobhistory`, `emp_license`, `emp_medical`, `emp_movement`, `emp_skills`.

Also: `barred` (7.2k), verification/float/for-release lists (`usp_employee*`).

GP `employees` is a working roster, not a 201 file.

### 6. 13th month, service charge, ATM

- `thirteenmonth` + `sp_thirteenmonth*` / `usp_thirteenmonth*`
- `servicecharge` + insert/list procs
- `ATM` / `atmexcel` / `SPbankreportall`

None of these are first-class in GP-HRIS.

### 7. Loans as payroll input

Legacy: `loan` → `loanschedule` (150k rows) → `USPLoanprocesstopayroll` / `sp_tkloanprocess` → `otherdeduction` on the register.

GP `employee_loans` exists but is not wired into a posted payroll register.

## GREENHRISMAIN tables (98)

`AccrualExcel`, `Accrualexport`, `adjustment`, `adjustmentnew`, `alphalist`, `alphalisttab`, `annualtax`, `ATM`, `atmexcel`, `atmsasytem`, `backupdefault`, `barred`, `billingadjustment`, `BILLINGEXPENSE`, `billinggroup`, `BILLINGTABLE`, `Cities`, `client`, `client_branch`, `client_branch_position`, `comboblank`, `companylogo`, `cuttoff`, `datehired$`, `Department`, `department_sub`, `emp_contacts`, `emp_dependents`, `emp_education`, `emp_exam`, `emp_jobhistory`, `emp_license`, `emp_medical`, `emp_movement`, `emp_skills`, `Employee`, `Employee1`, `employment_status`, `IncomeClass`, `interestrate`, `loan`, `loanschedule`, `maritalstatus`, `medicalstat`, `membershipinfoloan`, `messages`, `monthyear`, `OTCHART`, `otherdeduction`, `otherdeductionclass`, `otherdeductiondeleted`, `pagibigtable`, `paymentschedule`, `payroll_summary`, `payroll_summary2`, `payrolladjustmenttbl`, `paythrough`, `Philhealth`, `Philhealth_2018`, `picoclientbranchposition`, `provinces`, `religion`, `servicecharge`, `sex`, `Sheet1$`, `Sheet2$`, `Signatory`, `southmalldeduction`, `southmallpayroll`, `soutmalladjustment`, `SSS`, `SSSEmployerecom`, `SSSold`, `TAX`, `TAX_2018`, `TAX_EXEMPTION_2018`, `TAX_MONTHLY`, `TAX_MONTHLY_EXEMPTION`, `TAX_SEMI_EXEMPTION`, `TAX_SEMI_EXEMPTION1`, `TAX_SEMIMONTHLY`, `TAXTABLENEW`, `tbl_Bill_TemplateData`, `tbl_Bill_TemplateDataexpense`, `tbl_Bill_TemplateDataheader`, `tbl_timekeep`, `tbl_timekeeptemp`, `tblorganization`, `thirteenmonth`, `TIME_KEEPING`, `title`, `UPDATETOOTHERDEDUCTION`, `user_group_permission`, `user_maintenance`, `User_permission`, `usergroup`, `userorganizationtbl`, `yeartable`

Excel-import leftovers to ignore unless you need history: `Sheet1$`, `Sheet2$`, `datehired$`.

## GREENHRISMAIN views (20)

Payroll/statutory reporting: `FORPAGIBIG`, `FORPHILHEALTH`, `FORSSS`, `forwtax`, `lastpayrollemployee`, `lastpayrollemployeefinal`, `View_lastpayroll`, `Viewmonthlypayrollsummaryreport`, `ViewPayrollSummarymonthly`, `ViewPayrollsummaryperiod`, `PayrollClientpermonth`.

13th month: `View_thirteenmonth`, `viewthirteenmonthmonitoring`, `Viewthirteenmonthsummaryperclient`, `thirteenmonthselecviewlist`.

Loans / SC / billing / adjustments: `View_dateendloan`, `View_datefromloan`, `servicechargeselectviewlist`, `payrolladjustmentselectviewlist`, `View_BILLINGPROCESS`.

## What GP-HRIS has that legacy does not

These are new, not missing:

- Employee portal (sessions, devices, first login)
- GPS clock-in / location lock
- Leave **request** two-step approval
- Overtime **request** workflow
- Failure-to-log
- Week schedules / rest-day rules
- Incentive audit + payroll PDF audit (`payroll_summary_uploads`)
- CSM draft/verified employee tables (empty)

## Suggested build order if the goal is parity

1. Client → branch → position → department + cutoff calendar
2. Employee 201 subset actually required for payroll (gov IDs, rates, bank, status, client assignment)
3. Contribution tables (SSS / PH / Pag-IBIG / WTAX) and remittance views
4. Timekeeping cutoff document (`tbl_timekeep` equivalent) fed from GP clock data
5. Payroll register (`payroll_summary` equivalent) + posting
6. Loans into register
7. 13th month
8. Client billing (only if GP-HRIS must replace the old billing module)

## Security

The `sa` password was pasted in chat. Rotate it on `GPSQLSERVER01`, stop using `sa` for app access, and use a least-privilege SQL login. Nothing in this folder stores that password.
