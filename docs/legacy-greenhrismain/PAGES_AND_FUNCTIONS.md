# GREENHRISMAIN pages and functions

Source: procedure inventory (`summary.json` / `procedures/*.sql`) and permission schema (`user_group_permission`, `User_permission`).

**SQL functions:** **0** user-defined functions in GREENHRISMAIN.  
**Stored procedures:** **219** (all business logic).  
**Permission model:** each screen is an `objectdesc` with five verbs:

| Verb | Column | Meaning |
|---|---|---|
| Open / view page | `openobject` | Can open the screen |
| Add | `adddata` | Create |
| Edit | `editdata` | Update |
| Delete | `deletedata` | Delete |
| Preview / print | `preview` | Report preview |

Group defaults: `user_group_permission` (~20 page objects).  
Per-user overrides: `User_permission` (~514 rows).  
Users: `user_maintenance` (~33). Groups: `usergroup`.

> Exact `objectdesc` labels live in SQL (`SELECT objectdesc FROM user_group_permission`). That query needs `10.0.0.167:1433`. Below is the **screen map reconstructed from procedures**.

---

## Pages (screens) inferred from procedures

### 1. Dashboard
| Page | Key procedures |
|---|---|
| Main dashboard | `dashboard`, `dashboardemp`, `dashboardTCperyear`, `dashboardgrossperyear`, `dashboardclientgraph`, `timekeepdashboard` |

### 2. Employee / 201 file
| Page | Key procedures |
|---|---|
| Active employees | `usp_employeeactivelist` |
| Inactive | `usp_employeeinactivelist` |
| Float | `usp_employeefloatlist` |
| For verification | `usp_employeeforverification` |
| For release | `usp_employeeforreleaselist` |
| Barred | `usp_employeebarredlist` |
| On leave | `usp_employeeonleavelist` |
| Claimed | `usp_employeeclaimedlist` |
| Search / history | `usp_employeesearch`, `usp_employeesearchlist`, `usp_employeehistory` |
| Employee combo pickers | `usp_comboemployee_List`, `usp_comboemployee_Listwithemail` |

### 3. Client / branch / position
| Page | Key procedures |
|---|---|
| Client list | `sp_clientlist`, `sp_clientliststore`, `usp_comboclient_List` |
| Client branch | `usp_comboclientbranch_List` |
| Branch position | `usp_clientbranchpositionListclick`, `usp_cientbranchpositionListclick` |
| Department / job / group | `sp_departmentlist`, `sp_jobpositionlist`, `sp_groupnamelist` |
| Rates | `SPupdategrouprates`, `sp_clientratesbillinglist` |

### 4. Timekeeping (cutoff DTR — not live clock)
| Page | Key procedures |
|---|---|
| Upload / validate | `sp_tkprocessupload`, `sp_tkvalidationupload`, `sp_tktempdguploadlist` |
| Pending | `sp_tkpending` |
| Audit | `sp_tkforauditlist`, `sp_tkforaudit1`, `sp_tkauditforedit`, `sp_tkauditsave` |
| Correction | `sp_tkforcorrection` |
| Approval | `sp_tkforapprovelist`, `sp_tkforapproval1` |
| Process view | `sp_tkprocessviewlist`, `sp_tkdglist`, `sp_tkdglistclick` |
| Check before process | `sp_tkcheckbeforprocess` |
| Other income / deduction / loan / uniform / nameplate | `sp_tkotherincomeprocess`, `sp_tkotherdeductionprocess`, `sp_tkloanprocess`, `sp_tkuniformprocess`, `sp_tknameplateprocess` |
| Update details | `sp_tkupdatedetails` |
| Download / select | `sp_tkdownloadtimekeeplist`, `sp_timekeepselectlist` |
| Approved → payroll | `sp_tkapprovedfinal` |
| TK reports | `sp_tkreport`, `sp_tksummaryreport` |
| Cutoff pickers | `usp_combocuttoff_List*`, `usp_combopayoutdate_List*` |

### 5. Payroll register
| Page | Key procedures |
|---|---|
| Payroll summary list | `usp_PayrollSummary_List`, `usp_PayrollSummary_Listclick`, `formspayrollsummarylistview` |
| Process register | `payrollsummaryprocess` (+ dated copies) |
| Per client / month / period | `usp_Payrollsummaryperclient`, `usp_Payrollsummarypermonth`, `usp_Payrollsummaryperperiod` |
| Mandatory-only view | `usp_PayrollSummaryviewmandatoryonly` |
| Monthly report | `usp_monthlypayrollsummaryreport` |
| Color / select lists | `payrollselectlist`, `payrollselectcolor`, `sp_payrollmonth` |
| Posting | `USP_Payrollposting` |
| Status update | `SPupdatepayrollstatus` |
| Mandatory process | `SPupdateprocessmandatory`, `sp_mandatoryforprocessinglist` |

### 6. Payslips / receiving copies / Crystal reports
| Page | Key procedures |
|---|---|
| Payslip main | `sp_payslipmain`, `sp_payslipmainIND`, `SP_payslipind` |
| Payslip with value | `sp_payslipwithvalue`, `sp_payslipwithvalueIND`, `sp_payslipwithvaluedelete` |
| Print / receiving | `forpayslipreport*`, `forpayslipreceivingcopy*`, `forreceivingcopy`, `SCforreceivingcopy` |
| Email ready / sent | `SP_updateemailready`, `SPupdatesentemail`, `sp_emaillist*` |
| GUID report datasets | `42bf00bd-…` variants (15/30-day, mass/IND, SSS/PHI/Pag/WTAX/weekly) |

### 7. Payroll adjustment
| Page | Key procedures |
|---|---|
| Adjustment list / insert | `payrolladjustmentlist`, `payrolladjustmentinsert`, `payrolladjustmentselectlist` |
| Receiving copy | `payrolladjustmentforreceivingcopy`, `forpayslipreportpayrolladjustment` |

### 8. Statutory (SSS / PhilHealth / Pag-IBIG / WTAX / Alphalist)
| Page | Key procedures |
|---|---|
| SSS | `USP_SSS`, `SSS15TH` |
| PhilHealth | `USP_philhealth` |
| Pag-IBIG | `USP_pagibig` |
| WTAX | `USP_WTAX` |
| Alphalist | `USP_FORALPHALIST` |
| Report datasets | GUID procs `…SSS`, `…PHI`, `…PAG`, `…WTAX`, weekly variants |

### 9. Loans
| Page | Key procedures |
|---|---|
| Loan list / insert | `loanlist`, `loanlistinsert`, `loanshowempwithloan`, `loanemployeeselectlist` |
| Date combos | `usp_combofromdateloan_List`, `usp_comboenddateloan_List` |
| Process to payroll | `USPLoanprocesstopayroll`, `sp_tkloanprocess` |
| Mark paid | `SPupdateloanpaid` |
| Deduction list | `SPlistofdeduction`, `updateotherdeductiontoPS` |

### 10. SIL / leave / accrual
| Page | Key procedures |
|---|---|
| SIL | `SIL`, `usp_SILmonhtlyreport` |
| Accrual Excel | `usp_Accrual_GetExcelData*`, `usp_Accrual_InsertExcelData*` |

### 11. 13th month
| Page | Key procedures |
|---|---|
| List / insert / year | `thirteenmonthselectlist`, `thirteenmonthinsert*`, `thirteenmonthyear`, `sp_thirteenmonthlist*` |
| Reports | `usp_thirteenmonthmonhtlyreport`, `usp_thirteenmonthmonitoringperclient`, `usp_thirteenmonthsummaryperclient` |
| Cutoff combos | `usp_combocuttoff_List*13th` |

### 12. Service charge
| Page | Key procedures |
|---|---|
| SC list / insert | `servicechargelist`, `servicechargeselectlist`, `servicechargeinsert` |
| SC date combos | `usp_combofromdateSC_List`, `usp_comboenddateSC_List`, `usp_combopayoutdateSC_List` |

### 13. Client billing
| Page | Key procedures |
|---|---|
| Billing process | `BILLINGPROCESSNEW`, `billing-forbilling*`, `billing-viewprocess`, `billing-cancel`, `billing-details1-1` |
| Templates | `BILLINGGENERATETEMPLATE1*` (ALDEX / GENERIC / PLK + header/expense) |
| Billing combos | `sp_combodepartmentbilling`, `sp_combogroupnamebillingdetails`, `sp_combosheetnamebilling`, `usp_billingdetails_Listclick` |

### 14. Bank / ATM
| Page | Key procedures |
|---|---|
| Bank report | `SPbankreportall` |
| ATM tables | `ATM`, `atmexcel`, `atmsasytem` (data; procs mostly via bank report) |

### 15. Photos
| Page | Key procedures |
|---|---|
| Picture add / edit | `pictureprocessadd`, `pictureprocessedit` (PICTUREDB sibling DB) |

### 16. Users / security / backup
| Page | Key procedures |
|---|---|
| User list | `sp_userlist` |
| Backup | `sp_backup_full`, `sp_backup_differential`, `sp_backup_transaction_log`, `processbackup` |

---

## Functions (capability verbs), not SQL UDFs

In GREENHRISMAIN, a “function” on a page is one of:

1. **Open** — load the list/form  
2. **Add** — insert  
3. **Edit** — update  
4. **Delete** — soft/hard delete  
5. **Preview** — print / Crystal / receiving copy  

Wired per user via `User_permission` and per group via `user_group_permission`.

---

## Pull the live page list (when SQL is up)

```sql
-- Group template screens (~20)
SELECT idobject, usertype, objectdesc, openobject, adddata, editdata, deletedata, preview
FROM dbo.user_group_permission
ORDER BY objectdesc;

-- Distinct pages ever granted to anyone
SELECT DISTINCT objectdesc
FROM dbo.User_permission
WHERE objectdesc IS NOT NULL
ORDER BY objectdesc;
```

Save that output into this folder as `pages-from-permissions.json` when `10.0.0.167:1433` is reachable from this Mac.
