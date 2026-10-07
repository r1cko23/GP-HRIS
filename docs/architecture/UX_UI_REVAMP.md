# UX / UI revamp — three-app HRIS

Green Pasture staff apps (GP-HRIS, CSM-GP, GP-Client) share one polished HRIS language. Palette stays the existing green and warm neutrals; expression is new.

## Brand expression (same palette)

| Token | Value | Role |
|-------|-------|------|
| `--primary` | `147 66% 33%` | CTAs, focus ring, links |
| `--background` | `40 20% 98%` | Page canvas |
| `--card` | white | Panels, tables, dialogs |
| `--sidebar` | `148 42% 16%` | App chrome |
| Font | Source Sans 3 | All chrome and body |

Do not introduce Inter, Roboto, Plus Jakarta, purple gradients, or cream-serif marketing looks.

### Type

| Role | Classes |
|------|---------|
| Page title | `text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl` |
| Section | `text-base font-semibold tracking-tight sm:text-lg` |
| Body | `text-sm leading-relaxed text-foreground` |
| Meta | `text-xs text-muted-foreground` |
| Table header | `text-xs font-semibold tracking-tight text-muted-foreground` (sentence case) |
| Page tabs | Underline rail with primary bottom border — not gray pill tracks |
| Status filters | Soft outline pills (`variant="segment"`) |
| Stepper | Connected line, filled primary current/complete markers |

Chrome copy is **sentence case**. Names and places are title case.

**No instructional subtitles** under page titles or step labels (Frappe-simple). Titles stand alone; help lives in field labels, empty states, or toasts. Keep **status badge colors**.

### Density and chrome

Reference layout: **Time → Attendance** header (title left, From/To + actions right, hairline rule).

- Page stack: `dbPageWrapper` = `gap-3` / `sm:gap-3.5` / `md:gap-4` (no `lg:gap-6`)
- Page header: `dbPageHeaderRow` = `sm:items-center`, border `pb-3`
- Header actions: `dbHeaderActions` = `sm:items-end sm:justify-end`
- Controls: `min-h-11` / `sm:min-h-10`, `rounded-md`
- Panels: `border border-border/80 bg-card` (shadow only when interaction needs lift)
- **Metric / KPI cards**: compact row (`px-3 py-2`) — never `CardHeader` + `CardContent` split
- Tables: flat `dbTableShell` (border only)
- Icons in chrome: **Phosphor**
- Toasts: **Sonner** only
- Press: `active:scale-[0.97]` with `motion-reduce` respect

### Composition

One job per page: header, optional filter bar, one primary list or wizard, empty/loading states. No KPI clutter on workflow screens unless the hub is a dashboard.

## Shared kit (canonical in GP-HRIS)

| Component | Path |
|-----------|------|
| Button | `components/ui/button.tsx` |
| PageHeader | `components/ui/page-header.tsx` |
| DataTable | `components/ui/data-table.tsx` |
| Stepper | `components/ui/stepper.tsx` |
| WizardChrome | `components/ui/wizard-chrome.tsx` |
| Dialog / AlertDialog | `components/ui/dialog.tsx`, `alert-dialog.tsx` |
| Sheet | `components/ui/sheet.tsx` |
| EmptyState | `components/ui/empty-state.tsx` |
| Skeleton | `components/ui/skeleton.tsx` |
| StatusBadge | `components/ui/status-badge.tsx` |
| FilterBar | `components/ui/filter-bar.tsx` |

CSM copies these files. GP-Client maps the same APIs under `src/components/ui/` on Tailwind v4.

## Sync checklist

When changing a kit primitive:

1. Edit in GP-HRIS first.
2. Copy to CSM-GP `components/ui/`.
3. Port API to GP-Client `src/components/ui/` (v4 class strings if needed).
4. Smoke People hire, CSM job orders, Client schedule at 390 / 768 / 1280.
