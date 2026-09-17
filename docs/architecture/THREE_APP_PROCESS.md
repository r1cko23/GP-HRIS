# How the three apps work as one process

This is the **Deployed employment process**: Directory (who) → CSM (published headcount) → GP-Client (hours under that Client’s rules) → GP-HRIS (payroll register).

Organic house staff skip CSM and GP-Client. They stay **Clock → Cutoff hours → Payroll register** inside GP-HRIS. See [ORGANIC_PAYROLL_E2E.md](./ORGANIC_PAYROLL_E2E.md).

Technical seams, ID columns, and hour mapping: [DEPLOYED_INTEGRATION.md](./DEPLOYED_INTEGRATION.md). Product scope: [PRD.md](../PRD.md).

**Status:** Directory IDs are on CSM and GP-Client. Linked GP-Client sites add Period people from AM Verified. Validated Periods ingest cutoff hours into GP-HRIS when Directory env is set; `tbl_timekeep` JSON remains the dual-run fallback. Billing the client is **after payroll**, on the GP-HRIS cutoff hub.

---

## What each app is for

| App | Job in this process | Not its job |
|---|---|---|
| **GP-HRIS People** | Person, 201, rates, employee code. Organic Engagement. | Encoding DTR, AS Draft |
| **CSM-GP** | Publish Deployed headcount; Approve / Transfer / Resign writes Directory Engagement | New 201, timesheets, net pay, client SOA |
| **GP-Client** | Per-client timesheet rules, Period, encode/approve hours | Payroll register, remittance, 201 file, client SOA |
| **GP-HRIS Payroll** | Cutoff hours document → register → payslips / remittance / bank; **bill the client** after post | Client-specific ND/OT split rules |

One human has **one** `directory_employee_id`. CSM Verified and GP-Client roster are projections of that ID.

---

## One cutoff, end to end

```
1. People (HR)
   New hire / 201 / rates in Directory
   Deployed site + resign/rehire: CSM Approve writes that Engagement

2. CSM (AS → AM)                         Deployed only
   Draft reflects the assignment
   AM Approves → AM Verified **and** Directory branch/status
   Lock: no Draft edits on the 2nd and 17th (Asia/Manila)

3. GP-Client (timekeeping)
   Open a Period (dates + pay format)
   Seed: encoder **adds from AM Verified** only the people who worked
   (do not dump the whole Verified list onto the Period)
   Encode timesheets (that Client’s rules)
   Submit → payroll review → HR/Audit → Validated

4. Ingest (machine)
   GP-Client POSTs the hour matrix into GP-HRIS
   Grain: one cutoff_hours row per person, not punches
   HRIS cutoff status starts at approved (hours already gated)

5. Payroll (Finance in GP-HRIS)
   Same hub as Organic: /payroll/[id]
   Register lines = Verified people (hours from Validated timesheets)
   Build → post → downloads (payslips, remittance, bank)

6. Dual-run (until that Client cuts over)
   Keep tbl_timekeep JSON export as fallback into GREENHRISMAIN
   GP-HRIS is the target encoder; SQL Server is the safety net

7. Bill the client (GP-HRIS, after post)
   Same hours as payroll, **billing** rates, then SOA wrap (admin fee / VAT / EWT)
   Organic house staff have **no** billing twin.
```

Completion for **one Client, one kinsena:** Verified people, GP-Client Validated period, ingested `cutoff_hours`, posted `payroll_register_runs`, files downloaded. Same `directory_employee_id` on all four.

---

## Roster: three lists, one ID

For a Deployed Client and a cutoff window:

| List | Meaning |
|---|---|
| **Directory cutoff roster** | Current Active Engagement overlapping the dates (`isCutoffRosterRow`) |
| **AM Verified** | Ops published “these people are on this site” |
| **GP-Client Period employees** | People who have a timesheet this cutoff |

Payroll **pays people on the Validated timesheet**. Each of those people must be AM Verified and Active in Directory. AM Verified is who **may** be encoded, not who is auto-added to the DTR.

| Situation | What happens |
|---|---|
| Verified + hours | Pay (normal) |
| Verified, no hours | Stays Verified / Active at the Client; **not** on timesheet or register this cutoff |
| Hours, not Verified | **Forbidden** — cannot add to the Period |
| Draft name, not in Directory | Cannot add on Draft. HR creates the person in People, then AS picks that 201. |
| For release | Off this kinsena; final-pay run later |

---

## Hours gate (Deployed)

GP-Client already has the human gate:

`draft` → `submitted` (awaiting payroll) → `payroll_approved` (awaiting HR/Audit) → `approved` (Validated)

**Validated is the Deployed hours approval.** Ingest runs only from that state (or a later re-validate after correction). GP-HRIS does **not** wait on a second Submit Audit for Deployed. Pat can still open the hub; Build/Post stay in GP-HRIS.

Organic keeps Aggregate → Audit → Approve on the hub because hours come from live clock, not GP-Client.

Corrections after ingest, before Post: reopen in GP-Client (**correction**), fix, Validated again, ingest with `replace_existing: true`. After Post: open an **Adjustment Period** in GP-Client (hours verified → Validate → ingest into a separate GP-HRIS `period_kind = adjustment` cutoff), build a distinct Adjustment register, pay on the nearest payout date ([ADR 0017](../adr/0017-hours-based-adjustment-runs.md)). Do not fold missed hours into the next regular kinsena.

---

## Who creates the Client

| Surface | Creates | Must store |
|---|---|---|
| GP-HRIS People | Directory Client, branches, positions | Master row |
| CSM Add Client | Ops Client (Segment, AS owner) | `directory_client_id` |
| GP-Client Add Client | Timesheet Client + rules | `directory_client_id` |

Do not create a Directory person from a GP-Client timesheet name. If someone is missing, HR hires them in People, then the Period can seed.

Outlet on CSM/transmittal and GP-Client maps to Directory **Branch**. Position text maps to Directory **Position** (rate card). Display names may copy; rates always come from Directory at register build.

---

## Organic vs this process

| | Organic | Deployed (this doc) |
|---|---|---|
| Headcount | Directory house Client | CSM AM Verified |
| Hours | GPS bundy + OT/leave | GP-Client rules + Validated Period |
| Into `cutoff_hours` | `aggregate-from-office` | `POST .../ingest` |
| Payroll | `/payroll` hub | Same hub, same tables |
| Billing | None | GP-HRIS after posted register |

---

## Dual-run and exit (per Client)

Until Finance signs that Client off GREENHRISMAIN:

1. GP-Client Validated → ingest into GP-HRIS **and** keep **Download HRIS JSON** (`tbl_timekeep` shape).
2. Office may still INSERT that JSON into GREENHRISMAIN.
3. Compare GP register vs GREENHRISMAIN as diagnostic, not a veto.

**Exit for a Client:** one (then two) cutoffs posted entirely in GP-HRIS from ingested hours, remittance + bank produced, written sign-off. Then stop the JSON push for that Client.

Organic cutover (house staff) is a separate exit bar — two consecutive Organic cutoffs. It does not block identity wiring.

---

## What “done” looks like (pilot)

Pick **one** Deployed Client with a clean AM Verified list and a recent Validated GP-Client Period.

- [ ] Directory Client exists; CSM + GP-Client rows point at it
- [ ] Every Verified person and every Period employee has `directory_employee_id`
- [x] Ingest upserts `cutoff_hours` keyed by that ID
- [ ] `/payroll/[id]` builds and posts a register
- [ ] Payslip/remittance/bank files generate
- [ ] Count check: Verified vs hours vs register lines is explainable (paid / zero / needs review)

That is the process. The next file is how the systems hold it.
