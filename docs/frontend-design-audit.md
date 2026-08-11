# Frontend design audit — GP-HRIS

**Skill:** `.cursor/skills/frontend-design/`  
**Date:** Aug 2026

## Design plan

| | |
|---|---|
| **Subject** | Internal HRIS for Green Pasture staffing |
| **Audience** | HR admins, payroll ops, account managers |
| **Signature** | Payroll-trust KPI strip + approval queues (not decorative heroes) |
| **Tokens** | Canonical `app/globals.css` — keep byte-identical with CSM-GP |

## Top findings

1. **MetricCard** — `rounded-2xl` + icon-in-box shadcn template (`components/ui/metric-card.tsx`)
2. **Clock/bundy pages** — gray/emerald/orange gradients, `shadow-xl` (`app/clock/page.tsx`, `app/employee-portal/bundy/page.tsx`)
3. **Reports** — blue/indigo "Executive Summary" gradient (`app/reports/page.tsx`)
4. **Title case** — global `toTitleCase` on headers feels SaaS-generic
5. **Split toasts** — react-hot-toast vs Sonner across routes

## Recommended fixes (order)

1. Normalize MetricCard to `rounded-md border-border bg-card shadow-card`
2. Re-skin clock/bundy/reports to GP tokens
3. Unify on Sonner; standardize copy ("Signed in", "Sign out")

## Copy issues

- "Login successful!" → "Signed in"
- "Logout" → "Sign out"
- "Executive Summary" → "Cutoff summary"
- Empty states need next action, not "No data"
