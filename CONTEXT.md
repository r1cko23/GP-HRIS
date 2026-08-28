# HRIS

Operational people management for Green Pasture: **Directory** (employee 201 / Client view) plus office leave, overtime, live clock, and office payslips.

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

**Directory employee**:
The person of record in schema `directory` — one master 201 file per human (Deployed clients and Organic / GP house). Rehire updates this row; it does not create a second person. Bundy / leave / portal rows stay on `public.employees` and may store `directory_employee_id` as the enrollment link.
_Avoid_: engagement file (as the person), GREENHRISMAIN Employee_id (as identity)

**Employee code**:
Stable business ID on the Directory employee: `YYYYMM-#####` from first hire month, issued once. Never regenerated on rehire. Older codes (GREENHRISMAIN, YYYYMMDD) stay as aliases.
_Avoid_: Employee_id (legacy), engagement code

**First hire date**:
Original start date for the person; basis for a new Directory-issued employee code. Latest engagement start stays on hire date.
_Avoid_: rehire date (as the code basis)

**Engagement history**:
Prior hire episodes (legacy rehire codes) kept as superseded rows / aliases / movements under the same person — not separate people.
_Avoid_: duplicate employee

**Needs review**:
Directory cleanup queue: person is Active but missing from the client's latest released payroll cutoff. HR confirms leave, resign, or still working.
_Avoid_: stale (as a status), inactive (as automatic)

**Last payroll end**:
Latest cutoff end date the person appeared on (from payroll register). Used to compute needs review and days since last pay.
_Avoid_: last clock punch

**Office payroll**:
Payslips and deductions computed inside HRIS for GP staff via the weekly attendance path. Interim path until Organic uses the Payroll register.
_Avoid_: payroll register, billing, GREENHRISMAIN payroll_summary (as this path)

**Clock** / **Bundy clock access**:
Live GPS clock-in and clock-out in HRIS for people enrolled on `public.employees` (today mostly Organic). Not the legacy cutoff DTR (`tbl_timekeep`). Deployed hours today come from Payroll Timekeeping until a person is enrolled.
_Avoid_: timekeeping upload, DTR (as the live clock)

**Cutoff hours document**:
One row per person per Client cutoff, with the premium-hour matrix (reg / OT / ND / LH / SH / RD / WDO). Generated from Clock (and OT/leave). This is what payroll consumes.
_Avoid_: punch, time_clock_entry, DTR upload, tbl_timekeep

**Payroll register**:
The posted cutoff result in GP-HRIS: hours × rates, statutory, loans, net. For Organic / house staff there is no billing twin. Behavior ports GREENHRISMAIN `payroll_summary`; it is not a 1:1 clone of that table.
_Avoid_: payslip JSON alone, weekly_attendance, schema clone, Organic billing twin

**Organic cutover**:
Moment Organic / GP house staff stop using GREENHRISMAIN for time, pay, remittance, and bank files. Dual-run with Office payroll until two consecutive sample-matched cutoffs; then weekly writes stop. Live encoding stays in GP-HRIS; history import is only what YTD / open loans / Finance still need.
_Avoid_: full company cutover, Deployed cutover, bulk-clone-all-history (as the default)

**Sample match**:
Side-by-side check of one full Organic cutoff (all active bundy staff) — per person gross, statutory, loans, net — GP-HRIS Payroll register vs GREENHRISMAIN. Golden month = **July 2026** (`2026-07-01…15` and `2026-07-16…31`; primary replay = second kinsena). Joint written sign-off: Admin Mike Razal + Account Manager Michelle Razal per mismatch class; legacy may be stale.
_Avoid_: totals-only check, five-person spot check (as the exit bar), silent GP-wins

**Payroll history import**:
Prior GREENHRISMAIN rows brought into GP-HRIS for continuity: current-year YTD plus open loan balances/schedules first; multi-year register only if Finance still needs it inside GP. Distinct from Directory people ETL and from the live Clock → Cutoff hours → Payroll register path.
_Avoid_: migrated (as if people ETL included payroll history), full database clone

**Deployed gradual enrollment**:
Same Clock → Cutoff hours → Payroll register shape as Organic, rolled out person-by-person (or client-by-client) after Organic cutover is proven — not a second payroll product.
_Avoid_: forever-sibling-only for Deployed (as the end state)
