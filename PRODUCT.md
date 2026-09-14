# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: HR and Admin at Green Pasture People Management Inc. (Mike, Michelle, Pat) standing up **Clients** and **201 files**, then backfilling government IDs for a large Deployed roster.

Other audiences: Finance (cutoff register, remittance), timekeepers, house employees on `/employee-portal`. Employee-portal document upload is later — not this surface.

## Product Purpose

GP-HRIS is the Directory person master, Organic clock, and Organic payroll register for a Philippine manpower agency that deploys people to many client sites and also employs house staff.

Success on People: HR can create a Client or hire a person in short steps, leave gaps, resume later, and upload SSS / TIN / PhilHealth / Pag-IBIG / NBI scans. Organic **Build register** must not pay a line that still lacks those four numbers.

## Positioning

One person, one 201, many Clients. Organization is the tenant; Client is the working set. Siblings (CSM, GP-Client) store `directory_employee_id` — they do not invent a second person file.

## Operating Context

Office HR on desktop (and phone) at timelog.greenpasture.ph. ~29k Deployed people from GREENHRISMAIN plus Organic house. Paper 201s and ID photocopies are being digitized. Pay is kinsena-based (cutoff). Statutory remittance needs membership numbers on the 201.

## Capabilities and Constraints

- Five hubs + Settings: People, Benefits, Payroll, Time, Reporting. Portal is separate.
- Directory is person source of truth. Rehire updates the master (Tenure freeze). People ≠ Bundy enrollment.
- No mass Bundy of ~29k. Posted registers are immutable. Access is Grants (Pages + Functions).
- Benefits: loans stay a standing file; statutory *numbers* live on the 201; contribution *amounts* are Payroll. HMO/insurance out of scope.
- Government scans are sensitive personal information (RA 10173): private storage, signed URLs, HR-only upload in this pass.
- Hire may complete with gaps (warning). Missing SSS/TIN/PhilHealth/Pag-IBIG **blocks that Organic register line** before Build — not the whole cutoff.

## Brand Commitments

Green Pasture chrome: Source Sans 3, brand green `--primary`, warm neutrals, `rounded-md` cards. Do not introduce a second sans or a second green. Light mode default.

## Evidence on Hand

- Live People client list (Deployed/Organic, search, pagination).
- Lean hire dialog → dense 12-tab 201.
- Completeness helper (`lib/directory/completeness.ts`) already models ready-for-payroll from numbers, not scans.
- No employee document vault yet.

## Product Principles

1. Progressive disclosure: one step of a Client or 201 at a time; power-user edit stays available.
2. The 201 is the person; documents attach to the person, not to a Client or a cutoff.
3. Numbers gate pay; scans gate inspection/backfill queues.
4. Inherit Green Pasture Operate chrome; motion only to show step/state change.
5. Lists are always paginated, filterable, and searchable.

## Accessibility & Inclusion

Touch targets `min-h-11` mobile / `sm:min-h-10`. Honor `prefers-reduced-motion`. Do not rely on color alone for missing-ID state.
