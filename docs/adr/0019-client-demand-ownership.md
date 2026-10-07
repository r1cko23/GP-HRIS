# CSM owns Client Demand; Directory owns the staffing identities

## Status

Accepted — 2026-10-07. Clarifies [0013](./0013-deployed-verified-roster-three-databases.md).

## Context

Directory Clients, Branches, Positions, and rate cards describe valid master data. They do not answer how many workers a Client requested, for which dates, who approved the request, or whether it is filled. CSM already runs the operational AS Draft → AM Verified process, but a roster row currently mixes demand, nomination, placement, and person data.

Without an explicit owner, requested headcount can become a Directory field, GP-Client can infer demand from timesheets, and each app can report a different vacancy count. A timesheet is evidence of work, not a staffing request. A Position rate card is an approved kind of assignment, not a request to fill it.

## Decision

1. **CSM-GP owns Client Demand** for Deployed operations.
2. A Demand is a revisioned, effective-dated request for headcount at one Directory Client + Branch + approved Position. It records requested quantity, dates, status, operational owner, source/reference, and approval history.
3. Demand lifecycle is `draft` → `open` → `partially_filled` / `filled` → `closed`, with `cancelled` as a terminal alternative. Revisions preserve prior approved quantities and dates.
4. A proposed/approved Placement may reference the Demand it satisfies. Filling Demand counts effective approved Placements, not Persons copied into a roster and not people who happened to log hours.
5. Directory remains owner of Client, Branch, Position/rate card, Person, and Employment. CSM may reference those IDs but may not create a substitute master record.
6. GP-Client consumes effective approved Placements/Verified roster for period eligibility. It does not create Demand or treat a Period roster as demand.
7. GP-HRIS payroll and billing consume Approved Work. They may report demand-to-work variances but do not close or revise Demand.
8. Organic house staffing does not require CSM Demand. If Organic demand planning is introduced later, it requires a separate decision.

## Consequences

- CSM can report requested, proposed, placed, worked, and vacant headcount without conflating their grains.
- A person may transfer between demands while retaining one Person and Employment.
- Cancelling Demand does not erase historical Placements or Approved Work; it prevents new Placement approvals after its effective end.
- CSM commands and events carry canonical Directory IDs and a `demand_id`.
- Directory position approval must precede opening or revising Demand for that Position.
- Migration must derive initial Demand from current approved operational records or mark it as migrated; it must not invent exact historical approval facts.
