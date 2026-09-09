# Dual position on one cutoff is two assignments

A Deployed person may work two Positions at different rates in the **same** Cutoff period. That is two timesheet rows, two `cutoff_hours` rows, two payroll register lines, one `directory_employee_id`, one remittance identity.

`cutoff_hours` unique key becomes `(cutoff_period_id, directory_employee_id, position_id)` — not employee-only. A mashed single line with two rates is rejected.

The 201 Engagement still has one **primary** Position. The second job is a Cutoff assignment for that kinsena unless HR later makes it the primary via transfer.

CSM Lock stays the 2nd and 17th (Asia/Manila). Weekly Clients are a later exception.

Directory **Client** stays the employer (Nabati Food Philippines Inc.). Directory **Branch** is the site (Batangas). CSM and GP-Client rows store both UUIDs. Live Nabati data is one Client, one Branch “Manila”, site stuffed into job titles like `Tr-Ebo(Batangas 600)` — split Branches and move people; do not split into ten Directory Clients.

Cutoff periods are per Client + Branch + dates so each site keeps its own Validated Period.

## Status

Accepted — grill 2026-09-05.
