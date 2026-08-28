# Person-as-master transform (post-GREENHRISMAIN)

After ETL + status scrub, collapse rehire identity into **one live person** (ADR 0006 option A).

## What changes

| Layer | Behavior |
|---|---|
| **Master row** | Current engagement (`is_current_engagement = true`) — live roster |
| **`first_hire_date`** | Earliest hire in the person_key chain |
| **`hire_date`** | Latest engagement start (unchanged on master) |
| **`employee_code`** | **Kept** on master (legacy operational ID) |
| **Aliases** | Superseded codes + legacy_ids → `employee_code_aliases` |
| **Movements** | `PRIOR_ENGAGEMENT` rows on the master for each old episode |
| **Superseded 201 rows** | Kept for audit; hidden from default roster |

New Directory-native hires (not migrated) get `employee_code = YYYYMM-#####` from `first_hire_date` via `directory.allocate_employee_code`.

## Commands

```bash
# After migration 210 is applied
npm run transform:directory:person:dry
npm run transform:directory:person:apply
```

Prerequisites: scrub already ran (`person_key`, `is_current_engagement`, `superseded_by`).

## Employee ID format (`YYYYMM-#####`)

Live codes on **current engagements** use first hire **year-month** + sequence (org-scoped). ~10 hires/month, so day is not needed.

| Example | Meaning |
|---|---|
| `202601-00001` | First hire January 2026, sequence 1 that month |

- Old GREENHRISMAIN codes **and** prior `YYYYMMDD-#####` codes → `employee_code_aliases` (search still works)
- Linked `public.employees` copy the Directory master code (`employee_id` + `employee_code`)
- Invalid/missing hire dates fall back to `created_at`, else `197001`
- Sentinel SQL dates before 1990 are ignored

```bash
npm run transform:directory:recode:dry
npm run transform:directory:recode:apply
npm run transform:directory:recode:organic:dry   # ~140 Organic only
npm run transform:directory:recode:organic:apply
npm run export:organic:credentials               # login sheet after recode
```

**Note:** Office clock login IDs change with this recode for linked staff.

### Temporary live revert (Aug 2026)

Live Directory + office codes were **reverted** to pre-`YYYYMM-#####` values so portal login / ops keep working (passwords were never updated by the recode). Progress is preserved:

- `YYYYMM-#####` codes kept as deferred aliases (`Deferred YYYYMM-##### after temporary revert…`)
- Local script + migration 212 unchanged
- Re-cutover later: `npm run transform:directory:recode:apply`
- SQL used: `scripts/sql/revert-yyyymm-recode.sql`

```bash
npm run transform:directory:recode:revert:dry
```

## Hire-date cleanup


```bash
npm run scrub:directory:hire-dates:dry
npm run scrub:directory:hire-dates:apply
```

Fills null `hire_date` / `first_hire_date` from GREENHRISMAIN `datehired` when present.

**Finding (Aug 2026):** ~2,954 Directory rows with null hire also have **null** `datehired` / `datehiredtemp` / `datestart` / `Date_Reg` in SQL (mostly old inactive). Nothing to backfill from source — leave null; HR can set on Rehire / Edit when known.


| Metric | Count |
|---|---:|
| Employees loaded | 29,102 |
| Current engagements (people) | 28,718 |
| Rehire chains collapsed | 373 |
| Aliases registered | 384 |
| PRIOR_ENGAGEMENT movements | 384 |
| `employee_code_source = legacy` | 29,102 |
| Missing `first_hire_date` | ~2,879 (legacy null hire date — cannot invent) |

Live codes on current engagements are `YYYYMM-#####`. New Directory creates auto-issue the same format.

## Rehire going forward (HR UX)

1. Open existing person (search by name / SSS / TIN / **alias code** / live code).
2. On the 201 page, click **Rehire** (shown when status is not active).
3. Set new hire date, client/branch/position/rates → Confirm.
4. System sets `status = active`, keeps `employee_code`, preserves `first_hire_date`, clears resign/final-pay flags, writes a `REHIRED` movement.

API: `POST /api/directory/employees/:id/rehire`

Do **not** use Add employee for returnees.
