---
name: power-bi-reporting
description: >-
  Design Power BI–style payroll and financial dashboards in React (KPI cards,
  matrices, variance callouts, composition mix). Use when building or redesigning
  Trends, analytics, composition charts, audit insights, data reporting UI,
  Power BI–like layouts, or when the user dislikes a generic stacked-bar chart.
---

# Power BI–style data reporting (GP payroll audit)

## When this applies

User wants Trends / composition / analytics to feel like **Power BI or Excel pivot reporting**, not a single decorative stacked bar.

## Report layout (mandatory structure)

Build **report pages**, not one chart:

1. **KPI strip (4 cards max)** — latest total, Δ vs prior cutoff (₱ + %), period average, headcount or top mover.
2. **Primary visual** — one job only. Prefer:
   - **100% stacked** for mix/share over time, or
   - **Clustered column** for absolute totals over time  
   Avoid putting chart title text where value labels sit (no overlap).
3. **Matrix table** — categories as rows, cutoffs as columns, totals row; show ₱ and optional % of column. This is the Power BI “matrix” users expect.
4. **Detail pane** — click a period (not hover-only) to pin breakdown + hours. Hover may preview; selection sticks.

## Visual rules

- One question per visual; subtitle states the grain (e.g. “by cutoff”).
- Y-axis units always (₱). Compact labels (`₱27k`) OK; full amount in matrix/detail.
- Legend below or right; never collide with bars.
- Totals: show on KPI / matrix footer — **not** jammed into the chart title band.
- Highlight selected period; dim others.
- Color: stable category→color map across periods (reuse `COMPOSITION_COLORS` / slice keys).
- Dense but scannable: `tabular-nums`, right-align money, zebra optional, sticky first column on matrices.
- Mobile: KPI 2×2 → chart → matrix horizontal scroll → detail stacked.

## Anti-patterns (reject these)

- Lone stacked bar with overlapping title/value labels
- Hover-only detail with empty page until mouse moves
- Rainbow gradients, glow, emoji, card soup in the hero of a report
- Mixing hours and pesos on the same axis
- “Other / unmapped” dominating without a callout explaining layout gap

## Payroll audit specifics (this repo)

- Data: `PayrollSummaryUploadRecord[]` trend → `buildCompositionSeries` / category totals.
- Components live under `components/payroll-audit/`.
- Prefer existing UI (`CardSection`, `dbKpiGrid`, `dbTableShell`, `Table`) over new chart libraries unless asked.
- Trends tab should answer: *How did pay mix and totals move across cutoffs?*

## Implementation checklist

- [ ] KPI strip with prior-period deltas
- [ ] Chart mode: Absolute | % of total (toggle)
- [ ] Click-to-select period detail
- [ ] Composition matrix (category × cutoff)
- [ ] No overlapping SVG text
- [ ] “Other” callout when share is material
