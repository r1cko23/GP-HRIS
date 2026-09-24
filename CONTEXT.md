# HRIS

Operational people management for Green Pasture. The working set is six product areas: People, Benefits, Payroll, Time, Reporting, and Employee self-service.

Sibling product apps (separate hosts later): **Timekeeping** consumes Directory IDs and cutoff hours; **CSM** owns operations (Draft → Verified). They call `/api/directory/*` on this app — they do not own the person master.

## Language

**Grant**:
Assignment of one Page or Function to a User in Settings → Access Control.
_Avoid_: role (as the access check)

**Page**:
A screen a User may open (Employees, Payslips, Audit).
_Avoid_: module (in UI copy)

**Function**:
An action a User may run (Create employees, Approve leave, Approve payslips).
_Avoid_: permission (in UI copy)

**Starter pack**:
Named grant template (Admin, Head of HR, Approver). Seeds Grants; does not enforce after save.
_Avoid_: role (as the gate)

**People**:
The HR working set for Directory employees and Engagements — the 201 file and Client roster.
_Avoid_: Bundy enrollment (as People), Employees page (as the 201)

**Benefits**:
Money that is not base pay: loans, cutoff allowances, cutoff deductions, and statutory IDs (SSS, PhilHealth, Pag-IBIG, TIN).
_Avoid_: HMO, insurance (not in product)

**Payroll**:
Cutoff payroll: hours → register → payslip / remittance / bank; Deployed also **Client billing** after post.
_Avoid_: Office payroll weekly runs, `/payroll-office`, dashboard (as Payroll)

**Time**:
Clock, cutoff hours, leave / OT / failure-to-log, schedules, and Bundy enrollment.
_Avoid_: Directory 201 (as Time), Bundy clock access (as People)

**Reporting**:
Workforce and executive views, payroll register exports, BIR filings, and audit logs.
_Avoid_: dashboard (as a seventh product)

**Employee self-service**:
Portal for enrolled people: Bundy, requests, payslips, and personal info.
_Avoid_: HR hubs (as the employee working set)

**Directory employee**:
The person of record in schema `directory` — one master 201 file per human (Deployed clients and Organic / GP house). Rehire updates this row after freezing the prior Tenure; it does not create a second person. Bundy / leave / portal rows stay on `public.employees` and may store `directory_employee_id` as the enrollment link.
_Avoid_: Tenure (as a second person), GREENHRISMAIN Employee_id (as identity)

**Engagement**:
The live Tenure projected onto the Directory person — employer, Branch (site), primary Position, status, current hire/resign dates. **Deployed** site and active/resigned are written from CSM Approve / Transfer / Resign onto this row. **Organic** stays in People. Two jobs in one cutoff are Cutoff assignments, not a second person or a second Tenure.
_Avoid_: Directory employee (as the episode), Tenure (as a second 201), Bundy enrollment (as employment status), creating a new 201 after resign

**Department (store)**:
GREENHRISMAIN Department and Groupings tab (`dbo.Department`). Directory `client_departments`. CSM outlet stores `directory_department_id`. Not the payroll Branch (`client_branches`).
_Avoid_: branch (as this store list), position.department (rate-card text)

**Tenure**:
One employment episode on a Directory person — hire through exit (client, site, position, rates, final-pay outcome). Closed Tenures are immutable. Rehire opens a new Tenure on the same 201.
_Avoid_: second 201, new employee code, GREENHRISMAIN Employee_id (as a new hire)

**Final-pay barred**:
Closed Tenure whose unclaimed final pay aged past three years after last payout. That money stays barred; return is Rehire on a new Tenure.
_Avoid_: deployment barred (as this), deleting the 201, Activate (as the return)

**Deployment barred**:
Hold on the current Tenure that blocks deployment / payroll (conduct or ops block), not an aged unclaimed final pay. Clear with Activate on the same Tenure.
_Avoid_: final-pay barred (as this), Rehire (as the clearance)

**Employee code**:
Stable business ID on the Directory employee: `YYYYMM-#####` from first hire month, issued once. Never regenerated on rehire. Older codes (GREENHRISMAIN, YYYYMMDD) stay as aliases.
_Avoid_: Employee_id (legacy), engagement code

**First hire date**:
Original start date for the person; basis for a new Directory-issued employee code. Current Tenure hire date is the service date for this employment.
_Avoid_: rehire date (as the code basis), first hire (as SIL / 13th service date after rehire)

**Engagement history**:
Prior hire episodes (legacy rehire codes) kept as superseded rows / aliases / movements under the same person — not separate people. Closed Tenures are the Directory-native history going forward.
_Avoid_: duplicate employee, second 201

**Bundy enrollment**:
Link (or create) a `public.employees` row to a Directory employee so Clock, leave, OT, and portal work. Optional per person; does not own Engagement status. Auto-runs after Engagement hire/rehire when the Client is bundy-enabled.
_Avoid_: second person file, Directory hire (as enrollment)

**Bundy-enabled Client**:
Directory Client with `bundy_enabled` — Engagement hire/rehire best-effort enrolls Clock. Organic house Client is seeded on; other Clients flip on when added to bundy testing.
_Avoid_: organization-wide bundy (as automatic), Deployed mass onboard

**Organic house Client**:
The Directory Client for GP staff (Green Pasture People Management Inc.). Same Client shape as a deployed site: pay calendar, statutory policy, Bundy, Engagement roster.
_Avoid_: Office payroll (as this Client), a special employee type instead of a Client, Settings (as where house rules live)

**Client pay calendar**:
Standing day-of-month windows and pay frequency on a Directory Client. Opening a Cutoff period uses this template; it is not itself a cutoff.
_Avoid_: cutoff period (as the template), Settings (as where this lives — it lives on the Client in People)

**Client statutory policy**:
Which cutoff carries SSS / PhilHealth / Pag-IBIG / WTAX, plus contribution bases and COLA / SEA / CTPA flags, on a Directory Client. Payroll reads this; Time does not.
_Avoid_: pay calendar (as statutory), billing fee

**Cutoff period**:
One dated pay window for one Directory Client + **pay-scope Sites** (one Site = pay separately; many Sites = pay together on one register). Time writes Cutoff hours into it; Payroll posts the register against it. GP-Client Periods stay per site; HRIS may pull several Sites into one cutoff. Departments (stores) are not pay scope.
_Avoid_: client pay calendar (as the instance), kinsena (as the stored document), Department (as a separate payroll run)

**Cutoff assignment**:
One person + one Position + hours on one Cutoff period. Same human may have two assignments (two rates) in one kinsena. Unique on cutoff + Directory employee + position. Remittance still one person.
_Avoid_: second Directory employee, mashed single line with two rates, second Engagement

**Cutoff roster**:
Who Time must produce hours for, and who Payroll may pay, for one Cutoff period. **Organic:** Active Engagements that overlap the dates. **Deployed:** people **on the Validated timesheet** for that Client — each must be AM Verified and Active in Directory. AM Verified people with no hours that cutoff are not on the timesheet and not on the register.
_Avoid_: dumping the whole AM Verified list onto the DTR, all Directory employees, all clock punches (as the roster)

**AM Verified**:
CSM’s published list of who is serving at that site. Timekeeping may only add these people. Approve / Transfer / Resign here updates the Directory Engagement (same person, no new 201). Not the timesheet and not automatic payroll lines.
_Avoid_: Draft (as the paid list), treating Verified as “everyone goes on this kinsena”, treating Directory branch as fresher than Verified

**Needs review**:
Directory cleanup queue: person is Active but missing from the client's latest released payroll cutoff. HR confirms leave, resign, or still working.
_Avoid_: stale (as a status), inactive (as automatic)

**Last payroll end**:
Latest cutoff end date the person appeared on (from payroll register). Used to compute needs review and days since last pay.
_Avoid_: last clock punch

**Cutoff report pack**:
Finance files per posted cutoff: payslips, register summary, WTAX (with TIN), ATM bank upload, other-deduction particulars; SSS / PhilHealth / Pag-IBIG on the second window when statutory is Monthly. Sourced from GREENHRISMAIN report column lists, not Crystal.
_Avoid_: billing invoice, DTR Excel (Organic has no tbl_timekeep)

**Cutoff parity**:
Diagnostic compare of GP payroll register vs GREENHRISMAIN `payroll_summary` for the same Client dates. Classifies match / mismatch / GP-only / legacy-only; not a cutover gate (ADR 0009, 0011).
_Avoid_: amount oracle, blocking post on mismatch

**Office payroll**:
Payslips and deductions computed inside HRIS for GP staff via the weekly attendance path (`/payroll-office`). Interim dual-run path until Organic cutover; live ops use **Payroll** (cutoff hub → Payroll register).
_Avoid_: payroll register, billing, GREENHRISMAIN payroll_summary (as this path), Payroll (as this weekly path)

**Clock**:
Live GPS clock-in and clock-out in HRIS for people enrolled on `public.employees` (today mostly Organic). Not the legacy cutoff DTR (`tbl_timekeep`). Deployed hours today come from Payroll Timekeeping until a person is enrolled. HR manages enrollment under Time; employees clock in Employee self-service.
_Avoid_: timekeeping upload, DTR (as the live clock), People (as enrollment)

**Cutoff hours document**:
One row per person per Cutoff period, with the premium-hour matrix (reg / OT / ND / LH / SH / RD / WDO). Generated from Clock (and OT/leave) for the Cutoff roster. This is what payroll consumes.
_Avoid_: punch, time_clock_entry, DTR upload, tbl_timekeep

**Payroll register**:
The posted cutoff result in GP-HRIS: hours × **payroll** rates, statutory, loans, net. Organic / house staff have no billing twin.
_Avoid_: payslip JSON alone, weekly_attendance, schema clone, Organic billing twin

**Client billing**:
Invoice the Client for a posted Cutoff: same hours × **billing** rates, plus employer mandatories, then Client admin fee / VAT / EWT. Lives on the Payroll hub after post. Not payroll net and not a CSM document.
_Avoid_: payroll register (as the SOA), billing_gross_estimate (report-only), Organic house billing

**Catch-up correction** (removed):
Historical name for signed peso lines on `payroll_catchup_corrections`. Product path is **Adjustment run** only; the catch-up UI and write API return gone.
_Avoid_: queueing new peso catch-up; use Adjustment runs

**Adjustment run**:
A separate `cutoff_periods` row with `period_kind = adjustment` and `source_cutoff_period_id` pointing at a posted regular cutoff. Hours are verified in GP-Client (Adjustment Period / reopen), ingested into the open Adjustment cutoff, then built/posted as their own register and paid on the nearest payout date — without inflating the next regular kinsena’s basic/OT.
_Avoid_: re-ingest into a posted regular, nesting adjustment on adjustment, peso catch-up

**Cutoff report pack**:
The files Finance generates from one posted Payroll register: payslips, register summary, remittance (when the Client statutory policy says so), other-deduction list, and bank/ATM upload. Not Crystal/RDLC procs — those are report-only chrome.
_Avoid_: billing invoice (Organic has none), alphalist (annual), 13th month, DTR Excel (Organic has no `tbl_timekeep`)

**Remittance file**:
Government return for SSS, PhilHealth, Pag-IBIG, or WTAX: government ID, employee and employer shares (SSS also ECC and WISP). Organic Client statutory policy is Monthly — SSS/PhilHealth/Pag-IBIG on the second window; WTAX every cutoff.
_Avoid_: payslip (as remittance), EE-only CSV (as complete)

**PH payroll formulas**:
SSS, PhilHealth, Pag-IBIG, WTax, and DOLE premiums for a cutoff. Payroll register and Office payroll compose these; they do not each own a second copy.
_Avoid_: Payroll register (the document), Office payroll (the weekly dual-run path), payroll_summary clone

**Organic cutover**:
Moment Organic / GP house staff stop using GREENHRISMAIN for time, pay, remittance, and bank files. Dual-run with Office payroll until two consecutive cutoffs are finished entirely in GP (Payroll register posted, remittance + bank files) with written sign-off; then weekly writes stop. Live encoding stays in GP-HRIS; history import is only what YTD / open loans / Finance still need.
_Avoid_: full company cutover, Deployed cutover, bulk-clone-all-history (as the default), GREENHRISMAIN amount-match (as the exit)

**Sample match**:
Diagnostic side-by-side of one full Organic cutoff (all active bundy staff) — per person gross, statutory, loans, net — GP-HRIS Payroll register vs GREENHRISMAIN, to classify encoding faults vs missing GP variables. Golden month = **July 2026** (`2026-07-01…15` and `2026-07-16…31`; primary replay = second kinsena). Not the dual-run exit bar. Joint written sign-off on **current PH rules** and harvest keepers: Admin Mike Razal + Account Manager Michelle Razal.
_Avoid_: amount-equality (as cutover gate), totals-only check, five-person spot check (as the exit bar), silent GP-wins, clone stale legacy output

**Payroll history import**:
Prior GREENHRISMAIN rows brought into GP-HRIS for continuity: current-year YTD plus open loan balances/schedules first; multi-year register only if Finance still needs it inside GP. Distinct from Directory people ETL and from the live Clock → Cutoff hours → Payroll register path.
_Avoid_: migrated (as if people ETL included payroll history), full database clone

**Deployed gradual enrollment**:
Same Clock → Cutoff hours → Payroll register shape as Organic, rolled out person-by-person (or client-by-client) after Organic cutover is proven — not a second payroll product.
_Avoid_: forever-sibling-only for Deployed (as the end state)
