# Person, Employment, and Placement are separate records

## Status

Accepted — 2026-10-07. Extends [0006](./0006-person-is-master-rehire-updates.md), [0013](./0013-deployed-verified-roster-three-databases.md), and [0016](./0016-employment-tenure.md).

## Context

The current Directory employee row carries identity, employment episode, current Client/Branch/Position, and roster status. That projection was useful for migration, but it makes different lifecycle questions look like one mutable “employee”:

- **Person:** who is this human and which 201 file is theirs?
- **Employment:** when is this human employed by Green Pasture, under which employee code and separation outcome?
- **Placement:** where and in what Position is this employed person assigned for a bounded period?

Rehire must not create a second Person. Transfer must not end Employment. Ending a Placement must not imply resignation. A person can work a second Position in one cutoff without rewriting their primary assignment ([0014](./0014-dual-position-cutoff-assignments.md)). The three apps need stable identifiers for these facts instead of copying one mutable engagement row.

## Decision

1. **Person** is the lifelong Directory 201 identity. `person_id` is the existing canonical `directory_employee_id`; `employee_code` remains stable and is not an integration key.
2. **Employment** is a sequential legal/employment episode for one Person. It has `employment_id`, start/end dates, status, separation/final-pay outcome, and immutable historical snapshots. Rehire closes/freezes the prior Employment and opens another. Concurrent Employments remain out of scope.
3. **Placement** is an effective-dated assignment of one Employment to one Directory Client, Branch, and approved Position. It has its own `placement_id`, lifecycle, source demand, approver, and effective dates.
4. CSM-GP owns the Deployed Placement proposal and approval workflow. GP-HRIS Directory validates referenced Person, Employment, Client, Branch, and Position and projects the current approved Placement for People/payroll reads.
5. Organic Employment may receive a GP-HRIS-managed house Placement because CSM is not part of the Organic process.
6. Transfers end the source Placement and create a successor; they do not mutate history or create a Person. Ending Employment ends all open Placements. Ending only a Placement leaves Employment open for reassignment.
7. Work eligibility is evaluated at the work date against an effective approved Placement. Previously approved work remains linked to the historical Placement after transfer or separation.
8. The existing `directory.employees` assignment/status fields remain a compatibility projection during migration. They are not the long-term event or ledger key.

## Consequences

- APIs, events, Approved Work, Pay lines, and Bill lines carry `person_id`, `employment_id`, and `placement_id` where applicable.
- CSM AM Verified becomes a published view of approved effective Placements, not another person master.
- Headcount can distinguish employed-but-unplaced people from placed workers and from cutoff workers with Approved Work.
- Transfers, rehires, final pay, and dual-position cutoffs retain unambiguous history.
- Migration must backfill Employment and Placement IDs and reconcile them before making Placement authoritative.
- More records and effective-date validation are required; consumers can no longer infer employment or work eligibility from a single current-status column.
