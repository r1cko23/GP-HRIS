# Deployed roster is AM Verified; three databases; hours gate is GP-Client

AM Verified is the **eligibility pool** for a Deployed site: who AS/AM published as serving there. Timekeeping may only add Verified people. The **timesheet** is who worked this cutoff; Verified people with no hours stay off the DTR and off the register. AS may type Draft; Verify/Approve add is blocked without an existing `directory_employee_id` — CSM never inserts a second 201.

**Deployed Engagement (site + active/resigned) is written from CSM.** Approve add/edit, Transfer, and Resign/delete patch the same Directory person (rehire if inactive; branch change if they moved site). Rates, employee code, and the 201 stay in Directory. Creating a new Directory row after resign is how the file bloated; that is forbidden.

Hours approval for Deployed is GP-Client validation, not a second DTR audit in GP-HRIS. GP-HRIS builds and posts the register. Amends [0003](./0003-clock-does-not-call-greenhrismain.md) for Deployed only.

Every Directory Client appears in CSM with exactly one **assigned monitor** (AS or Payroll). CSM and GP-Client keep their own databases; they store Directory UUIDs.

**Directory Client** = employer (Nabati Food Philippines Inc.). **Directory Branch** = site (Batangas) — the CSM/GP-Client row.

## Status

Accepted — grill 2026-09-05; amended 2026-09-05 (Verified ≠ timesheet; CSM writes Directory Engagement on Approve/Transfer/Resign; no new 201 on rehire).
