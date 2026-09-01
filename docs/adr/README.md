# ADRs

Living decisions. Do not delete a file because a later ADR **amends** it — mark status and link.

| # | Decision | Status |
|---|---|---|
| [0001](./0001-directory-owns-tenancy.md) | Directory schema in this Supabase project; siblings call `/api/directory/*` | Accepted |
| [0002](./0002-organization-is-tenant.md) | Organization = tenant; Client = working set | Accepted |
| [0003](./0003-clock-does-not-call-greenhrismain.md) | No INSERT/EXEC to GREENHRISMAIN from Clock | Accepted |
| [0004](./0004-office-employees-align-with-201.md) | Office `public.employees` 201-shaped; UIs stay unmerged | Accepted |
| [0005](./0005-office-clock-vs-deployed-timekeeping.md) | Organic bundy vs Deployed DTR; no mass onboard | Accepted |
| [0006](./0006-person-is-master-rehire-updates.md) | One master 201; rehire updates | Accepted |
| [0007](./0007-organic-cutover.md) | Organic cutover program (register, dual-run, history import) | Accepted — **exit bar amended by [0009](./0009-greenhrismain-is-catalog.md)** |
| [0008](./0008-engagement-bundy-enrollment.md) | Engagement + Bundy enrollment + org gate | Accepted |
| [0009](./0009-greenhrismain-is-catalog.md) | GREENHRISMAIN is variables/procs, not an amount oracle | Accepted |
| [0010](./0010-six-product-areas.md) | Six product areas; Settings is not a seventh; Office payroll is dual-run | Accepted |
| [0011](./0011-catalog-driven-hris.md) | GREENHRISMAIN read-only catalog + parity; GP owns runtime amounts | Accepted |
| [0012](./0012-next-cutoff-catchup.md) | Posted payroll corrections via next-cutoff catch-up (not void / off-cycle run) | Accepted |

Nothing here is deprecated. [0009](./0009-greenhrismain-is-catalog.md) replaces only the **amount-match-as-exit** clause of 0007, not the cutover program.
