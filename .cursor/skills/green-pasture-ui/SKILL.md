---
name: green-pasture-ui
description: >-
  Shared Green Pasture UI/CSS design system for CSM-GP, GP-HRIS, and
  GP-Client-Attendance-Payroll. Use when styling UI, editing globals.css,
  adding buttons/cards/forms, choosing fonts/colors, or aligning look-and-feel
  across these three apps.
---

# Green Pasture shared UI

Uniform chrome for **CSM-GP**, **GP-HRIS**, and **GP-Client-Attendance-Payroll**.

## Source of truth

| Layer | Canonical location |
|-------|--------------------|
| Tokens + shell CSS | `GP-HRIS/app/globals.css` (and matching `:root` in CSM-GP) |
| Tailwind v3 map | `GP-HRIS/tailwind.config.ts` |
| Tailwind v4 map | `GP-Client-Attendance-Payroll/src/app/globals.css` (`@theme inline`) |
| Font | **Source Sans 3** (`next/font/google` → `--font-sans` / `--font-source-sans`) |
| Brand green | `--primary: 147 66% 33%` |
| Surfaces | Warm neutrals `--background: 40 20% 98%`, white `--card` |

When changing brand colors, update **all three** `globals.css` `:root` HSL channel values so they stay identical. See [reference.md](reference.md).

## Non‑negotiables

1. **Do not** introduce Inter / Plus Jakarta / Roboto as the app sans.
2. **Do not** invent a second green; use `primary` / `bg-primary` / legacy `bg-gp`.
3. Prefer semantic tokens: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-muted`, `bg-accent`, `text-primary`.
4. Radius: `rounded-md` (0.5rem) for cards/inputs/buttons — not large “AI pill” radii.
5. Shadows: `shadow-card` / `shadow-hover` (cool gray, not purple glow).
6. Light mode only by default; dark only under `.dark` (ignore OS preference).
7. Touch: primary controls `min-h-11` mobile / `sm:min-h-10`.

## New UI checklist

- [ ] Uses shared tokens (no one-off hex for brand/chrome)
- [ ] Source Sans 3 loaded in root layout
- [ ] Cards: `rounded-md border border-border bg-card shadow-card`
- [ ] Primary CTA: `bg-primary text-primary-foreground hover:bg-primary/90`
- [ ] Body copy: `text-muted-foreground` for secondary text
- [ ] Mobile inputs ≥ 16px (global rule already in HRIS/Client CSS)

## App-specific notes

| App | Stack | Alias notes |
|-----|-------|-------------|
| GP-HRIS / CSM-GP | Tailwind v3 + shadcn | Use `primary`, `muted`, `sidebar-*` |
| GP-Client | Tailwind v4 | Same tokens + legacy `gp` / `gp-muted` / `gp-border` mapped to primary/muted/border |

GP-Client print CSS and timesheet layouts stay local; chrome tokens stay shared.

## When aligning an app

1. Diff `:root` against GP-HRIS `globals.css`.
2. Ensure font is Source Sans 3 in `app/layout.tsx`.
3. Map theme utilities (v3 `tailwind.config` or v4 `@theme`).
4. Update shared primitives (button, card, input, page header, alert).
5. Smoke at 390 / 768 / 1280.

## Additional resources

- Token tables & component recipes: [reference.md](reference.md)
