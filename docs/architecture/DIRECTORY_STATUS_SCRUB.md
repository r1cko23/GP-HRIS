# Directory status scrub & person dedup

## What “for release” means

In **GREENHRISMAIN**, `finalpaystatus` tracks **final pay / exit processing** — not whether someone is still clocking in this week.

| Legacy `finalpaystatus` | Meaning | Directory `status` |
|---|---|---|
| **`Release` / `For Release`** | Employee is **leaving** (resigned/separated). HR is processing or waiting to release **final pay**. Listed in `usp_employeeforreleaselist` — **not** the regular kinsena. | `for_release` |
| **`Unrelease`** | Final pay **not** released yet — **normal** employment state (do **not** treat as exiting). | `active` or `inactive` based on `status` |
| **`Claimed`** | Final pay already claimed / case closed. | `inactive` |
| **`Barred`** | Final pay unclaimed **more than 3 years** after last payout, or blocked from deployment. | `barred` |
| *(empty)* | No final-pay workflow flag. | `active` / `inactive` from `status` |

**Common confusion:** ~2,000+ people can be **`status = Active`** and still **`For Release`** — they are **active in SQL but exiting** (last payroll cycle). That is expected, not a duplicate.

---

## ETL bug fixed (Unrelease)

Previous ETL used:

```ts
if (forRelease.includes("release")) return "for_release";
```

`"Unrelease".includes("release")` is **true**, so **~5,988** rows were wrongly marked `for_release`.

Fixed in `lib/directory/legacy-status.ts` — only exact **`Release`** and **`For Release`** map to `for_release`.

---

## Why we keep ~29k rows (professional rule)

Each row is a **201 file / engagement** (hire episode), not always a unique human.

| Layer | Rows | Use |
|---|---:|---|
| `directory.employees` (all) | ~29,100 | Full audit history, rehires, old codes |
| **`directory.roster_current`** (view) | ~28,600 | **One current engagement per person** |
| By **status** (current engagements) | see scrub output | Operational headcount |

**We do not delete** inactive rehire files. We:

1. Normalize **status** from legacy source fields.
2. Compute **`person_key`** (SSS+TIN+DOB → SSS → name+DOB → legacy_id).
3. Set **`is_current_engagement = false`** on older codes for the same person.
4. Link **`superseded_by`** → preferred current 201 row.

Same person with codes `6151`, `6843`, `8828` → **3 files, 1 current engagement**.

---

## Normalized status (legacy-aligned)

Priority (first match wins):

1. `barred` — dbo.barred or `finalpaystatus = Barred`
2. `float` — `employee_status` contains Float
3. `for_verification` — verification queue
4. **`for_release`** — `finalpaystatus IN ('Release', 'For Release')`
5. `inactive` — InActive / resigned / on leave / Claimed
6. **`active`** — `status = Active`

---

## Commands

```bash
# Preview status changes + dedup counts (safe)
npm run scrub:directory:dry

# Write normalized status + person keys + superseded flags
npm run scrub:directory:apply

# Preview extra current 201s + same-SSS review queue (does not delete)
npm run dedup:directory:dry

# Park extra current 201s onto the existing person UUID (no deletes)
npm run dedup:directory:apply-split

# Park same-SSS files whose current last+first names match (no deletes)
npm run dedup:directory:apply-sss-name

# Park same name+DOB extras when only one current file has a last payout (no deletes)
npm run dedup:directory:apply-name-dob

# Park all auto ID matches: split + SSS/TIN/PhilHealth/Pag-IBIG same-name + name+DOB (no deletes)
npm run dedup:directory:apply-ids

# Fold parked superseded 201s into closed employment_tenures on the master
npm run fold:directory:tenures:dry
npm run fold:directory:tenures:apply

# Merge same-name active+inactive clients (Dionne / Goldilocks)
npm run merge:directory:clients:dry
npm run merge:directory:clients:apply

# Pull new hires + use fixed status on future ETL
npm run etl:directory:resume
```

`--new-only` now collapses split current engagements after insert so a GREENHRISMAIN rehire code does not leave two live 201s.

Same-SSS / TIN / PhilHealth / Pag-IBIG groups with **matching current names** can be parked with `--apply-ids` (or the narrower `--apply-sss-name`). Same name+DOB with **exactly one last payout** can be parked with `--apply-name-dob` (the paid file is the person). Mixed-name ID shares and shared bank accounts stay in People → **Possible duplicate**. HR confirms on the original 201 (Park extra 201); we do not auto-merge those. Extra 201s stay stored as superseded so the live roster is **one current file per person**. After parking, fold prior episodes into `employment_tenures` with `fold:directory:tenures:apply`.

After scrub, headcount:

```sql
SELECT * FROM directory.roster_status_totals(
  (SELECT id FROM directory.organizations WHERE name = 'Deployed')
);
```

---

## Expected counts (after scrub, Deployed org)

Approximate from live GREENHRISMAIN (not deleted):

| Bucket | ~Count |
|---|---:|
| All 201 files | 28,961 |
| **Current engagements** (deduped) | ~28,600 |
| **`active`** (current) | ~3,000+ |
| **`for_release`** (current) | ~2,800 |
| **`inactive`** / **`barred`** (current) | remainder |

Payroll cutoff headcount (~2,100) is **active** on the regular kinsena. `for_release` is the final-pay list, not that count.

Next step after scrub: **person-as-master transform** — see [DIRECTORY_PERSON_MASTER.md](./DIRECTORY_PERSON_MASTER.md) and ADR 0006.
