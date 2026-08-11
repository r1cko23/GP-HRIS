# GP-HRIS — frontend-design overlay

## Subject

**Internal HR information system** for Green Pasture staffing. Audience: HR admins and managers. Job: find employee records, run HR workflows with confidence.

## Non-negotiables (with green-pasture-ui)

- Brand kit: `/Users/ecko/Desktop/Green Pasture/brand/`
- Tokens: `app/globals.css` (canonical for CSM-GP parity)
- Source Sans 3, shared sidebar shell with CSM-GP
- Do **not** introduce a second green or Inter-family sans

## Shell

App sidebar + page headers. Data tables and forms dominate.

## Audit focus

1. Dashboard landing — first impression after login
2. Table density, empty states, filter bars
3. Primary CTAs and destructive actions (clear labels)
4. Motion: `.gp-pressable` only where it aids feedback

## Companion skills

- `green-pasture-ui` — tokens (byte-identical with CSM-GP)
- `emil-design-eng` — interaction polish
