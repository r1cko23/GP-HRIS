# HRIS

Operational people management for Green Pasture. The working set is six product areas: People, Benefits, Payroll, Time, Reporting, and Employee self-service.

Sibling product apps (separate hosts later): **Timekeeping / Payroll** consume Directory IDs and cutoff hours; **CSM** owns operations/billing. They call `/api/directory/*` on this app — they do not own the person master.

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
Organic cutoff payroll: attendance → cutoff hours → register → payslip and summary downloads.
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
The person of record in schema `directory` — one master 201 file per human (Deployed clients and Organic / GP house). Rehire updates this row; it does not create a second person. Bundy / leave / portal rows stay on `public.employees` and may store `directory_employee_id` as the enrollment link.
_Avoid_: engagement file (as the person), GREENHRISMAIN Employee_id (as identity)

**Engagement**:
The current employment episode of a Directory employee — client, branch, position, status, and hire/resign dates on the master row. Transitions (hire, rehire, transfer, release, float, bar, activate) change this episode; they do not create a second person.
_Avoid_: Directory employee (as the transition), Bundy enrollment (as employment status), public.employees row (as the episode)

**Employee code**:
Stable business ID on the Directory employee: `YYYYMM-#####` from first hire month, issued once. Never regenerated on rehire. Older codes (GREENHRISMAIN, YYYYMMDD) stay as aliases.
_Avoid_: Employee_id (legacy), engagement code

**First hire date**:
Original start date for the person; basis for a new Directory-issued employee code. Latest engagement start stays on hire date.
_Avoid_: rehire date (as the code basis)

**Engagement history**:
Prior hire episodes (legacy rehire codes) kept as superseded rows / aliases / movements under the same person — not separate people.
_Avoid_: duplicate employee

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
One dated pay window for one Client. Time writes Cutoff hours into it; Payroll posts the register against it.
_Avoid_: client pay calendar (as the instance), kinsena (as the stored document)

**Cutoff roster**:
Engagements on that Client whose hire and resign dates overlap the Cutoff period — the people Time must produce hours for. Bundy enrollment is how they punch, not who is in scope to be paid.
_Avoid_: all Directory employees, all clock punches (as the roster)

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
The posted cutoff result in GP-HRIS: hours × rates, statutory, loans, net. For Organic / house staff there is no billing twin. Behavior ports GREENHRISMAIN **keep** variables; it is not a 1:1 clone of `payroll_summary`.
_Avoid_: payslip JSON alone, weekly_attendance, schema clone, Organic billing twin

**Catch-up correction**:
A signed peso line that fixes under/over pay from a **posted** Cutoff period by landing on a later **open** Cutoff period for the same Client. The posted register stays immutable; the apply cutoff’s register carries `earnings.adjustment`.
_Avoid_: adjustment run (off-cycle), void posted register, editing posted amounts, Office payslip adjustment_amount (weekly dual-run only)

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
