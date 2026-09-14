---
version: 1
slug: "route-people"
primary_target: "route:/people"
related_targets: ["route:/people/clients/new","route:/people/c","route:/people/c/clientId/employeeId","route:/people/c/clientId/employeeId/onboard"]
---

# People

**Mode:** Operate
**Audience:** HR/Admin hiring, transferring, and backfilling 201s for Deployed clients and Organic house.
**Job:** Pick a client or a work queue, stand up a client or person without a wall of fields, attach government scans, resume incomplete files.
**Primary action:** Add client (wizard) or Add employee (lean hire → onboard steps).
**Proof:** Real client names, headcounts, needs-review, missing statutory/docs counts — not empty marketing states.
**Constraints:** Inherit GP chrome. Directory SoT. People ≠ enrollment. Grants. RA 10173 on scans.

## Direction

Queue-first People index; stepped Client create; stepped employee onboard; 201 briefing + Documents tab. Signature motion: 200ms `--ease-out` step crossfade (`opacity` + `translateY(4px)`). Completeness bar uses `scaleX`, not width.

## Memorable moment

HR finishes Identity, hits Continue, and the person exists — remaining steps are optional until the next Organic payroll Build, which names who is blocked.
