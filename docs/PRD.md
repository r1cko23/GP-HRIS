# Product requirements — Green Pasture HRIS

**Product:** GP-HRIS, tied to CSM-GP and GP-Client-Attendance-Payroll  
**Owner:** Green Pasture People Management Inc.  
**Status:** Living — describes **where we are** (2026-09) and **what “done” means** for one employment process  
**Audience:** product, ops (Mike / Michelle / Pat), and agents implementing in this repo

Glossary: [CONTEXT.md](../CONTEXT.md). Seams: [architecture-essentials.md](./architecture/architecture-essentials.md).

---

## 1. Problem

Green Pasture deploys people to many client sites (hotels and non-hotel) and also employs its own house staff. Ops today split that across four systems that do not share a person:

| System | What it does well | Gap |
|---|---|---|
| **GREENHRISMAIN** | Production payroll for ~29k Deployed + Organic remittance/bank | SQL Server on the office LAN; 219 procs; not the product we are building |
| **GP-HRIS** (this app) | Directory 201, Organic GPS clock, Organic cutoff register, leave/OT/portal | Deployed hours and CSM headcount are not wired in |
| **GP-Client-Attendance-Payroll** | Per-client timesheet rules, cutoff DTR, Excel/PDF, `tbl_timekeep` export | **No payroll.** Own client/employee tables. Still aimed at GREENHRISMAIN |
| **CSM-GP** | AS Draft → AM Verified headcount, lock windows, transmittal audit | Own employee tables. Does not call Directory |

The result: three rosters, hours that stop at SQL Server, and payroll that is only live in GP-HRIS for Organic house staff. The requirement is **one process** from “this person works at this client/branch/position” through hours to a posted register.

---

## 2. Product vision

A **multi-tenant HRIS** (tenant = Organization) with two working worlds:

- **Organic** — GP house. Same Client shape as a deployed site (pay calendar, statutory policy, Engagement roster). Live bundy. Payroll in GP-HRIS. No billing twin.
- **Deployed** — Client sites. Each Client has **branches**, **positions** (rate cards), and an Engagement roster. Hours follow **that Client’s timesheet rules**. Headcount is published in CSM. Payroll consumes approved cutoff hours + Directory rates.

The three apps stay separate **products**. They share **Directory IDs** and a **Cutoff hours document**. They do not share three copies of the human.

```
Engagement (who, where, rate)
    → Headcount publish (CSM, Deployed)
    → Hours (Clock or GP-Client rules)
    → Cutoff hours document
    → Payroll register (GP-HRIS)
    → Payslips, remittance, bank / (Deployed) Client billing after post
```

---

## 3. Users

| User | Needs |
|---|---|
| **HR / Admin** | 201 file, hire/rehire/transfer/release, Bundy enrollment, Organic cutoff hub |
| **Account Supervisor** | CSM Draft roster for owned Clients; GP-Client timesheets for those sites |
| **Account Manager** | CSM Verification/Approval; Segment headcount |
| **Timekeeper / auditor (Pat Relos)** | Approve cutoff hours before payroll posts |
| **Finance** | Posted register, remittance, ATM/bank upload, catch-up — not Crystal |
| **House employee** | Portal: bundy, leave/OT/FTL, payslips |
| **Grant editor** | Pages + Functions per user (not job-title RBAC) |

Sign-off for Organic cutover: **Admin Mike Razal** and **Account Manager Michelle Razal**.

---

## 4. The one process (requirements)

### 4.1 People (Directory) — SoT for the person

- Organization is the tenant; Client is the working set.
- Deployed Clients have branches and positions; the 201 holds current Engagement (client, branch, position, status, hire/resign).
- One person, one employee code, rehire updates the master.
- Lifecycle: active, for_release, inactive, barred, float, for_verification, plus the **Needs review** queue (active but missing from the client’s latest payroll).
- Siblings **must** store `directory_employee_id`. They may copy name/position for display.

**Now:** People UI + kernel + ETL from GREENHRISMAIN. Organic house Client seeded.  
**Missing:** CSM and GP-Client still create their own people.

### 4.2 Headcount (CSM) — SoT for published Deployed roster

- AS maintains Draft; AM/Admin publish to AM Verified; lock 2nd and 17th.
- Transmittal Audit diffs payroll Excel against Verified without mutating it.
- Downstream counts (who should appear on a cutoff) read Verified **joined to Directory**.

**Now:** CSM workflow is live on its own database.  
**Missing:** Directory UUID on every CSM employee; hire/transfer/release should follow Directory Engagement, not a second 201.

### 4.3 Time (two sources, one grain)

**Organic**

- GPS clock, schedules, leave, OT, failure-to-log on enrolled `public.employees`.
- Aggregate → cutoff hours → human audit/approve.

**Deployed**

- GP-Client Period + Timesheet with **per-client rules** (overnight, ND, OT minimum, straight shift, allowances, pay format, export layout).
- Approved timesheet becomes cutoff hours in GP-HRIS via ingest — not a punch mirror, not a second payroll.

**Now:** Organic path works in GP-HRIS. GP-Client rules engine works but exports GREENHRISMAIN JSON. Ingest API exists and is unused by the sibling.  
**Missing:** GP-Client stores Directory IDs and POSTs ingest; stop treating `tbl_timekeep` push as the end state.

### 4.4 Payroll (one engine, in GP-HRIS)

- Hours × Directory rates + Client statutory policy + loans + PH formulas → **Payroll register**.
- Exports: payslips, summary, SSS / PhilHealth / Pag-IBIG / WTAX when the Client policy says so, other deductions, bank/ATM.
- Posted register immutable; catch-up on the next open cutoff.
- GP-Client **does not** grow a payroll module.

**Now:** Organic hub (`/payroll`) can aggregate, edit hours, build, post, download. Dual-run weekly `/payroll-office` still exists. July 2026 sample-match is diagnostic. Deployed Nabati proof cutoff can Process billing then download SOA / debit memo ([CLIENT_BILLING_SOA.md](./architecture/CLIENT_BILLING_SOA.md)).  
**Missing:** Organic cutover exit bar (two GP-complete cutoffs + sign-off). Deployed Client on the same hub as production. YTD / open-loan history import.

### 4.5 Reporting and self-service

- Workforce / register / BIR / audit in HRIS; cutoff parity vs GREENHRISMAIN as a diagnostic, not a gate.
- Enrolled people use the employee portal.

---

## 5. Capability matrix

| Capability | Organic | Deployed |
|---|---|---|
| Person master in Directory | Shipped | Shipped (ETL ~29k) |
| Branches / positions on Client | Same Client shape | Shipped in Directory; CSM/GP-Client not synced |
| Live GPS bundy | Shipped (~99 enrolled) | Per-person later; no mass onboard |
| Per-client timesheet rules | House rules via clock + OT/leave | Shipped in GP-Client |
| Cutoff hours in GP-HRIS | Shipped (aggregate-from-office) | API ready; sibling not calling it |
| Payroll register in GP-HRIS | Shipped (dual-run) | Not in production; GREENHRISMAIN |
| CSM headcount | N/A | Shipped in CSM; not Directory-keyed |
| Remittance / bank from GP | Built; cutover not signed | Still GREENHRISMAIN |
| Billing / admin fee | Out of scope | GP-HRIS after posted register |

Treat `docs/status/PROJECT_STATUS.md` as historical (Addbell weekly-timesheet era). This matrix is the current scoreboard.

---

## 6. Phased delivery

### Phase A — Organic cutover (in progress)

Prove the house path so Finance leaves GREENHRISMAIN for GP staff.

1. Keep encoding in `/payroll` (Clock → hours → register → files).
2. Dual-run weekly Office payslips until two consecutive GP-complete cutoffs + Mike/Michelle sign-off.
3. Import current-year YTD + open loans (not a full history clone).
4. Sample-match July 2026 to classify encoding faults vs missing variables — not a veto.

**Exit:** Organic ops (time, pay, remittance, bank) run only in GP-HRIS.

### Phase B — Tie the three apps (the integration PRD)

How it works (design, before code): [THREE_APP_PROCESS.md](./architecture/THREE_APP_PROCESS.md), [DEPLOYED_INTEGRATION.md](./architecture/DEPLOYED_INTEGRATION.md).

One identity, hours land in the same grain.

1. **Directory IDs in GP-Client** — `directory_client_id` on clients, `directory_employee_id` on roster; pull roster from `/api/directory/employees?client_id=`.
2. **Ingest instead of SQL push** — after AM/timekeeper approval, POST cutoff hours into GP-HRIS; keep JSON export as a fallback during dual-run.
3. **Directory IDs in CSM** — Verified/Draft rows keyed to Directory; Transmittal Audit can resolve names via Directory when needed.
4. **Cutoff roster** — Timekeeping and payroll include Engagements that overlap the cutoff (Directory), intersected with CSM Verified for Deployed.

**Exit:** A Deployed Client can be paid from GP-HRIS register lines whose hours came from GP-Client and whose people exist once in Directory.

### Phase C — Deployed gradual payroll

Same product shape as Organic, **one Client at a time**. Flip `bundy_enabled` only for Clients (or people) that should punch in HRIS. CSM remains the headcount publish step. Billing stays in CSM.

**Exit:** GREENHRISMAIN is catalog/history for that Client, not the live encoder.

---

## 7. Functional requirements (build against these)

**FR-1** Every paid human has one Directory employee; payroll lines reference `directory_employee_id`.  
**FR-2** Deployed assignment is Client + Branch + Position on the Engagement.  
**FR-3** Opening a cutoff uses the Client pay calendar; statutory flags on the Client drive remittance windows.  
**FR-4** Organic hours come from approved clock/OT/leave; Deployed hours come from approved GP-Client timesheets.  
**FR-5** Different Deployed Clients may use different timesheet rules; payroll still sees one hour matrix.  
**FR-6** CSM Verified is the published Deployed headcount; it does not replace Directory identity.  
**FR-7** Payroll register lives only in GP-HRIS.  
**FR-8** Lists are paginated, filterable, and searchable server-side.  
**FR-9** Access is Grants (Pages + Functions) plus attributes.  
**FR-10** Posted pay is immutable; corrections are catch-up on a later cutoff.

---

## 8. Non-functional

- One GP-HRIS Supabase project for Directory + clock + register.
- Sibling apps authenticate with `x-directory-api-key` + `x-organization-id`; they do not expose `directory.*` via PostgREST.
- PH labor formulas in `lib/ph-payroll` (DOLE premiums, SSS, PhilHealth, Pag-IBIG, WTax).
- Privacy: RA 10173 — see `docs/privacy/`.
- Shared chrome: Source Sans 3, brand green tokens (green-pasture-ui skill).

---

## 9. Out of scope (this PRD)

- Merging the three Next.js apps into one host.
- Mass Bundy enrollment of ~29k.
- Cloning GREENHRISMAIN `payroll_summary` (297 columns) or EXEC-ing T-SQL as the runtime.
- Organic billing / CSM for house staff.
- HMO / insurance (not in Benefits).
- Unifying CSM / HRIS / GP-Client logins into one IdP (later).

---

## 10. Success

**Organic:** two consecutive cutoffs posted in GP with remittance + bank files, written sign-off, weekly Office path retired.

**Integration:** for a chosen Deployed Client, CSM Verified count, GP-Client timesheet roster, and GP-HRIS cutoff roster resolve to the **same Directory UUIDs**, and the register posts from ingested hours.

**Language:** agents and ops use the glossary (Engagement, Cutoff hours, Grant, AM Verified) instead of “employee” meaning three tables.
