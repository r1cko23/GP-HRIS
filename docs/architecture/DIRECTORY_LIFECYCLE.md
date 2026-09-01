# Directory lifecycle — source of truth

Directory owns **client management**, **employee (person) management**, and **employment lifecycle**. Downstream cutoff / payroll / CSM consume master UUIDs and status — they do not invent headcount.

## Lifecycle vocabulary

| Status | Meaning | Payroll |
|---|---|---|
| **Active** | Employed / on roster | Include when scheduled |
| **Needs review** *(queue, not a status)* | Marked active but **not on the client's latest released payroll cutoff** | HR must verify: still working, leave/maternity, or resign |
| **For release** | Leaving — final pay in progress | Off the regular cutoff; dedicated final-pay run later |
| **Inactive** | Separated / not engaged | Exclude; **Rehire** to return |
| **Barred / Float / For verification** | Side paths | See status meta |

## Stale detection (last payroll)

`last_payroll_end` = max `payroll_summary.Date_End` for the person's `legacy_id` (GREENHRISMAIN).

For a client, **latest cutoff** = max `last_payroll_end` among that client's current engagements.

**Needs review** = `status = active` AND (`last_payroll_end` is null OR `< client latest`).

Inactive rows show **days since last payroll** so HR can clean old files without guessing.

```bash
npm run sync:directory:last-payroll:dry
npm run sync:directory:last-payroll:apply
```

Re-run after each major payroll release in GREENHRISMAIN (until Directory cutoffs are the live source).

## HR cleanup loop

1. Open **Directory** → client with **Needs review** filter (default on roster; URL `?status=needs_review&q=&offset=`).
2. Open each **201** — Lifecycle shows a **Needs review** decision strip when flagged:
   - Still working (keep Active; confirm on next payroll)
   - Leave / float
   - Start final pay
   - Mark inactive
3. Returnees → **Rehire** on Inactive only (never Add employee). Float / barred / verification use **Activate**.

## Lifecycle actions (201 cockpit)

| Action | Effect |
|---|---|
| **Transfer client** | Same person + Employee ID; new client/branch/position; `TRANSFERRED` movement |
| **Start final pay** | `for_release` + resign date |
| **Complete final pay** | `inactive` |
| **Float / Bar / For verification** | Queue statuses with movements (Bar and Mark inactive require remarks) |
| **Activate** | Clear float / barred / verification / cancel release |
| **Rehire** | **Inactive only** → active on a client (immutable code). Office paths may pass `force`. |

## 201 completeness

Checklist on the 201: identity, SSS/PhilHealth/Pag-IBIG/TIN, client+position, daily rate, bank/GCash. Missing chips open **Edit** on the matching section. Not a hard block — flags remittance gaps for HR.

## Roster UX

- Debounced search + filters + pagination; state in the URL (`status`, `q`, `offset`, `history`).
- Empty states distinguish queue clear vs no matches vs no people on file.
- “Showing X–Y of Z” on the roster.

## SoT rules

- Headcount = `roster_current` (current engagement only)
- One person = one master 201 (ADR 0006)
- Employee ID immutable on rehire / transfer
- Siblings store `directory_employee_id` (master UUID), not legacy emp id
- Bundy / portal rows = linked `public.employees` — not a second person file
