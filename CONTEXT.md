# HRIS

Operational people management for Green Pasture staff and deployed workers after they exist in Directory: leave, overtime requests, live clock, and office payslips.

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
The person of record in schema `directory`. Office clock/leave rows stay on `public.employees` and may store `directory_employee_id` as an optional link.
_Avoid_: master employee, 201 file

**Office payroll**:
Payslips and deductions computed inside HRIS for GP staff. Not the GREENHRISMAIN `payroll_summary` register.
_Avoid_: payroll register, billing

**Clock**:
Live GPS clock-in and clock-out in HRIS. Not the legacy cutoff DTR (`tbl_timekeep`).
_Avoid_: timekeeping upload, DTR

**Cutoff hours document**:
One row per person per Client cutoff, with the premium-hour matrix (reg / OT / ND / LH / SH / RD / WDO). Generated from Clock (and OT/leave). This is what payroll consumes.
_Avoid_: punch, time_clock_entry, DTR upload, tbl_timekeep

**Payroll register**:
The posted cutoff result: hours × rates, statutory, loans, net, billing twin. GREENHRISMAIN `payroll_summary`.
_Avoid_: payslip JSON, weekly_attendance
