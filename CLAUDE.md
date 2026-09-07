# GP-HRIS — agent brief

Green Pasture’s HRIS. This repo owns the **Directory** person master, Organic **Clock**, Organic **Payroll register**, and the `/api/directory/*` + `/api/timekeeping/*` contracts siblings call. It is not CSM and not the deployed timesheet app.

## Read first

| When the task is… | Load |
|---|---|
| **Scope**, Organic vs Deployed, what to build next, three-app process | [docs/PRD.md](docs/PRD.md) |
| **Seams**, ownership, current vs target (one screen) | [docs/architecture/architecture-essentials.md](docs/architecture/architecture-essentials.md) |
| **Topology**, schema, APIs, Organic vs Deployed flows | [docs/architecture/Architecture.md](docs/architecture/Architecture.md) |
| **Deployed three-app process** (Directory → CSM → GP-Client → register) | [docs/architecture/THREE_APP_PROCESS.md](docs/architecture/THREE_APP_PROCESS.md) |
| **Deployed integration** (UUID columns, ingest, hour map) | [docs/architecture/DEPLOYED_INTEGRATION.md](docs/architecture/DEPLOYED_INTEGRATION.md) |
| **A term** (Grant, Engagement, Cutoff hours, Organic house Client) | [CONTEXT.md](CONTEXT.md) |
| **Why** a seam exists | [docs/adr/README.md](docs/adr/README.md) |
| **Sibling contract** (`x-directory-api-key`, ingest, IDs to store) | [docs/architecture/DIRECTORY_INTEGRATION.md](docs/architecture/DIRECTORY_INTEGRATION.md) |
| **Organic cutoff hub** (aggregate → post → exports) | [docs/architecture/ORGANIC_PAYROLL_E2E.md](docs/architecture/ORGANIC_PAYROLL_E2E.md) |
| **List UI / API** (search, filters, pagination) | [.cursor/rules/list-pagination-filters-search.mdc](.cursor/rules/list-pagination-filters-search.mdc) |
| **Chrome / tokens** | `.cursor/skills/green-pasture-ui/SKILL.md` |
| **Access** (Pages + Functions, not `role === admin`) | `webapp-abac` skill |

Sibling glossaries live outside this repo: `../GP-Client-Attendance-Payroll/CONTEXT.md`, `../../CSM-GP/CONTEXT.md`, `../GP-Directory/CONTEXT.md`.

## Product

HR chrome is five hubs + Settings ([ADR 0010](docs/adr/0010-six-product-areas.md)): **People**, **Benefits**, **Payroll**, **Time**, **Reporting**. Employees use `/employee-portal`. `/payroll-office` is dual-run only.

Two Organizations in Directory: **Deployed** (client sites, branches, positions, ~29k) and **Organic** (GP house, live bundy, cutoff payroll). Client is a view inside an Organization, not a tenant ([ADR 0002](docs/adr/0002-organization-is-tenant.md)).

## Hard rules

1. **Directory is person SoT.** Siblings store `directory_employee_id` (current engagement). They do not invent a second person file. Rehire updates the master ([ADR 0006](docs/adr/0006-person-is-master-rehire-updates.md)). **Deployed** site + active/resigned are written from CSM Approve / Transfer / Resign onto that row ([ADR 0013](docs/adr/0013-deployed-verified-roster-three-databases.md)).
2. **Clock never writes GREENHRISMAIN.** No INSERT/EXEC to SQL Server from runtime ([ADR 0003](docs/adr/0003-clock-does-not-call-greenhrismain.md)). GREENHRISMAIN is a read-only catalog ([ADR 0009](docs/adr/0009-greenhrismain-is-catalog.md)).
3. **Punches do not post payroll.** Both Organic clock and Deployed DTR converge on a **Cutoff hours document**; the **Payroll register** consumes that.
4. **No mass bundy** of ~29k Deployed into `public.employees` ([ADR 0005](docs/adr/0005-office-clock-vs-deployed-timekeeping.md)). Enroll one person or one Client (`bundy_enabled`).
5. **People ≠ Enrollment.** `/people` is the 201. `/time/enrollment` is Bundy/portal. Do not merge those UIs ([ADR 0004](docs/adr/0004-office-employees-align-with-201.md), [ADR 0008](docs/adr/0008-engagement-bundy-enrollment.md)).
6. **Posted registers are immutable.** Money fixes are next-cutoff **catch-up corrections** ([ADR 0012](docs/adr/0012-next-cutoff-catchup.md)).
7. **Access is Grants.** Gate on Pages and Functions; starter packs seed, they do not enforce.
8. **Organic first.** Prove house payroll in this app, then Deployed one Client at a time ([ADR 0007](docs/adr/0007-organic-cutover.md)).

## Where code lives

| Need | Look |
|---|---|
| Hubs / nav | `lib/hubs.ts` |
| Directory APIs | `app/api/directory/**`, `lib/directory/` |
| Cutoff + ingest | `app/api/timekeeping/**`, `lib/timekeeping/` |
| Register / exports | `lib/payroll-register/`, `lib/ph-payroll/` |
| Organic hub UI | `app/payroll/`, `app/payroll/[id]/` |
| Schema | `supabase/migrations/202_directory_kernel.sql`, `208_cutoff_hours_kernel.sql`, `213_organic_payroll_register.sql` |

`docs/status/PROJECT_STATUS.md` and `docs/legacy-greenhrismain/GAP_MAP.md` predate Directory + the cutoff register. Prefer the PRD and Architecture docs for “where we are.”
