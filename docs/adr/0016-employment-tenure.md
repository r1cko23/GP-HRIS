# Employment tenure is first-class; rehire closes the prior episode

Directory keeps **one Person** (201) and one `employee_code` for life ([0006](./0006-person-is-master-rehire-updates.md)). Rehire still updates the live 201 — it does **not** insert a second person — but it first **freezes** the prior **Tenure** (rates, resign date, final-pay outcome) and opens a new current Tenure. Final-pay barred is a closed-Tenure outcome: return is Rehire, not Activate. Deployment barred is a hold on the current Tenure: clear with Activate. Concurrent multi-client employment stays out of scope. Payroll-document cold storage is a later retention track, not a second 201.

## Status

Accepted — 2026-09-11. Amends the “rehire only patches the master row” reading of [0006](./0006-person-is-master-rehire-updates.md).

## Considered options

- **A (chosen):** Sequential Tenures on one person. Live 201 is the current Tenure projection.
- **B:** New 201 / new employee code (GREENHRISMAIN) — rejected; that is how the file bloated.
- **C:** Movements-only history — rejected; rehire would still mutate rates, resign date, and final pay on the live row.
