# Directory integration (GP-HRIS)

Directory is **schema `directory` on this same Supabase project**. It is the shared person/client kernel for separate web apps:

| App | Owns | Uses Directory for |
|---|---|---|
| **GP-HRIS** | Directory UI + office clock / leave / OT on `public.employees` | Master 201 roster (`/directory`) |
| **Timekeeping / Payroll** (sibling app) | Cutoff hours, register, payslips | `directory_employee_id`, rates, Client view |
| **CSM** (operations) | Clients ops, billing twin | Client / branch / position / employee IDs |

Sibling apps do **not** read `directory.*` via PostgREST. They call GP-HRIS `/api/directory/*` with `x-directory-api-key` + `x-organization-id`.

- UI: `/directory` (Admin/HR session cookie)
- ETL: `npm run etl:directory:dry` → `apply` / `resume` / `children`
- Office link: `npm run link:office-directory` then `--apply`
- Link columns: `public.employees.directory_employee_id`, `directory_client_id` (backfill via `link:office-directory`)

**Schema alignment (redesign):** migration `207` adds Directory-shaped columns on `public.employees` (`employee_code`, `sex`, `status`, `daily_rate`, bank, email, etc.). Legacy clock columns (`employee_id`, `gender`, `is_active`, `per_day`) are mirrored by trigger until UI migration completes. Read model: `public.employees_as_201`. See [ADR 0004](../adr/0004-office-employees-align-with-201.md).

## Target product split (end state)

```
GP-HRIS          → Directory (tenant + Client view + 201) + office bundy
Timekeeping app  → punches / cutoff hours document (consumes Directory IDs)
Payroll app      → payroll register (consumes approved cutoff + Directory rates)
CSM              → operations / billing (consumes Directory Client + positions)
```

Same Supabase Pro project. No second project. Do not EXEC GREENHRISMAIN procs.

## Frozen API contract (siblings)

### Auth

| Header | Required | Meaning |
|---|---|---|
| `x-directory-api-key` | yes (siblings) | Must equal `DIRECTORY_SERVICE_API_KEY` |
| `x-organization-id` | yes | Tenant UUID (`directory.organizations.id`) |
| Cookie session | Admin/HR UI only | Browser `/directory` — no API key |

Unauthorized → `401`. Missing org → `400`.

### Tenancy vs Client view

| Layer | What | How you pass it |
|---|---|---|
| Tenant | Organization | Header `x-organization-id` |
| View | Client | Query `client_id` or path `/directory/c/:clientId` |

Attendance / payroll apps bind **one** `directory_client_id` locally and never list other Clients unless the product intentionally supports multi-client ops users.

### Endpoints (stable shapes)

All success bodies: `{ "data": ... }`. Errors: `{ "error": "message" }`.

| Method | Path | Query | Response `data` |
|---|---|---|---|
| `GET` | `/api/directory/organizations` | — | `Array<{ id, name, slug, is_active }>` |
| `GET` | `/api/directory/clients` | optional search | clients + headcounts |
| `GET` | `/api/directory/clients/:id` | — | one client |
| `GET` | `/api/directory/clients/:id/branches` | — | branches for that client |
| `GET` | `/api/directory/positions` | `client_id`, optional `branch_id` | positions / rate cards |
| `GET` | `/api/directory/employees` | **`client_id` required**; `q`, `status`, `page` (`q` also matches prior alias codes) | roster page |
| `GET` | `/api/directory/employees/:id` | — | employee + client/branch/position embeds |
| `POST` | `/api/directory/employees/:id/rehire` | — | rehire existing person (no new code; ADR 0006) |
| `PATCH` | `/api/directory/employees/:id` | — | whitelisted 201 fields (status, assignment, contact, IDs, bank, rates) |
| `GET` | `/api/directory/employees/:id/file` | optional `client_id` | employee + 201 children sheets |
| `GET` / `POST` | `/api/directory/employees/:id/contacts` | optional `client_id` on GET | list / create emergency contacts |
| `PATCH` / `DELETE` | `/api/directory/employees/:id/contacts/:contactId` | — | update / remove one contact |
| `GET` / `POST` | `/api/directory/reconcile/fill-missing-from-201` | optional `office_employee_id` on POST | Fill blank office fields from linked Organic 201 |
| `GET` / `POST` | `/api/timekeeping/cutoff-periods` | `client_id`, `status` on GET | List / create cutoff batch (Deployed DTR) |
| `GET` | `/api/timekeeping/cutoff-periods/:id` | `include=hours,punches` | One cutoff + optional rows |
| `POST` | `/api/timekeeping/cutoff-periods/:id/ingest` | — | Upsert premium-hour matrix + DTR punches |
| `GET` / `POST` | `/api/directory/reconcile/office-organic` | `needs_review` on GET | HR compare Office ↔ Organic; decide link / create / skip (no auto-merge) |
| `GET` | `/api/directory/employees/:id/history` | — | status / movement history if present |

### Identity fields siblings must store

Copy these UUIDs into the sibling DB; do not re-key by `legacy_id` or name:

- `organization_id`
- `client_id`
- **`directory_employee_id`** = master person UUID (`directory.employees.id` where `is_current_engagement = true`)

Do **not** bind cutoff / payroll / CSM headcount to superseded engagement rows or raw GREENHRISMAIN `Employee_id`. Resolve prior codes via `employee_code_aliases` → master UUID when ingesting legacy DTR.

**Operational headcount:** `directory.roster_current` or RPCs `client_employee_counts` / `dashboard_employee_totals` / `roster_status_totals` (all current-engagement only).

**Payroll-eligible statuses:** `active` + `for_release` (final pay may still process). Exclude `inactive`, `barred`, `float`, `for_verification` unless product explicitly overrides.

Cutoff ingest validates employees with `is_current_engagement = true` only.

Also store when useful: optional `branch_id`, `position_id`. `employee_code` is display / search only. `legacy_id` is ETL-only.

### Employee status vocabulary

`active` | `inactive` | `barred` | `float` | `for_release` | `for_verification`

See `lib/directory/employees.ts` (`EMPLOYEE_STATUS_META`) for payroll meaning. For release ≠ inactive: may still be paid once.

### Events (optional webhooks)

If `DIRECTORY_WEBHOOK_URLS` is set, GP-HRIS POSTs:

- `employee.upserted`
- `employee.status_changed`
- `employee.rehired`

Payload includes `organization_id` and employee (or ids). Treat as best-effort notifications; siblings should still re-fetch on demand.

## Two people systems inside GP-HRIS (do not merge in the UI)

| Surface | Table | Who | What you manage there |
|---|---|---|---|
| **Employees** `/employees` | `public.employees` (~99 rows) | Office + a few client-based clock users | Create/edit profile, locations, SIL, OT group, bundy login, leave/OT/FTL |
| **Directory** `/directory` | `directory.employees` (~29k) | GREENHRISMAIN roster by Client | 201 file, client assignment, statutory/bank identity for deployed payroll |

```
Organization (tenant)          ← Deployed | Organic
  └── Client (employer view)   ← hotel / brand you pick in /directory
        └── directory.employees + 201 children

public.employees               ← clock / leave / OT only
  └── optional directory_employee_id → directory.employees.id
  └── optional directory_client_id   → directory.clients.id
```

### How to manage day to day

1. **Person master (everyone)** → **People → Directory** → Deployed (clients) or Organic (GP house) → client → person.
2. **Bundy / portal / leave / OT** → **Time → Bundy clock access** (`/employees`). Rows are `public.employees` linked with `directory_employee_id`.
3. **Same human, link clock to Directory** — People → Link bundy access, or `npm run link:office-directory -- --apply`. Linking does not merge UIs.
4. **Deployed hours today** → GP Payroll Timekeeping (manual / DTR). Do not dump Directory into live clock tables.
5. **Future:** enroll more people (including deployed) into bundy one-by-one via linked clock access; Directory master stays the SoT.

## Duplicate rules (checked against live data)

| Check | Result | Meaning |
|---|---|---|
| `directory` `(organization_id, legacy_id)` | **0 dups** | ETL upsert key is clean |
| `directory` `(organization_id, employee_code)` | **0 dups** | Codes unique per org |
| `public.employees.employee_id` | **0 dups** | Office list is clean |
| Same name + DOB in Directory | ~557 groups | Mostly **rehires / redeploys**. Prefer status, not merge |
| Office code = Directory code | **~97 / 99** | Link script fills `directory_employee_id` |
| Office with no Directory code | **~2** | Office-only; no automatic Directory twin |

Status scrub (legacy-aligned): see [DIRECTORY_STATUS_SCRUB.md](./DIRECTORY_STATUS_SCRUB.md). Fixes Unrelease→for_release ETL bug; use `directory.roster_current` for deduped headcount.

## Same Pro project (do not create a new Supabase)

PostgREST must include `directory` in **Exposed schemas**. Migration `203_directory_expose_postgrest.sql` sets `authenticator.pgrst.db_schemas`. Table grants are **service_role only**; apps go through `/api/directory/*`.

## Env

In `.env.local` (never commit):

- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DATABASE` — GREENHRISMAIN (`10.0.0.167`)
- `DIRECTORY_SERVICE_API_KEY` — CSM / Timekeeping / Payroll (`x-directory-api-key`)
- `DIRECTORY_WEBHOOK_URLS` — optional webhooks

### ETL / link commands

```bash
npm run etl:directory:dry
npm run etl:directory:apply
npm run etl:directory:resume          # skip existing employees; still sync children
npm run etl:directory:children        # 201 children + barred only (needs SQL)
npm run seed:directory:barred         # dry-run barred list from status=barred
npm run seed:directory:barred -- --apply
npm run scrub:directory:hire-dates:dry
npm run scrub:directory:hire-dates:apply
npm run link:office-directory         # dry-run office ↔ Directory links
npm run link:office-directory -- --apply
```

When SQL `10.0.0.167:1433` is unreachable (common off the office LAN/VPN):

1. Employee roster already in Directory stays valid — do **not** re-run full apply.
2. Seed barred list from Directory status: `npm run seed:directory:barred -- --apply`.
3. 201 children sheets (`employee_contacts`, dependents, …) stay empty until SQL is up, then: `npm run etl:directory:children`.
4. Office ↔ Directory links do **not** need SQL: `npm run link:office-directory -- --apply`.

Children ETL is deferred until GREENHRISMAIN is reachable; Directory remains the only place for the ~29k roster.
