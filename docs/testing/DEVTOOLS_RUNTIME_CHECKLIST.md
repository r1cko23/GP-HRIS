# DevTools Runtime Checklist

Use this checklist during manual browser validation (Chrome DevTools) and automated runtime checks.

## Critical Routes

- `/dashboard`
- `/timesheet`
- `/payslips`
- `/leave-approval`
- `/overtime-approval`
- `/failure-to-log-approval`
- `/time-entries`
- `/device-activity`
- `/employee-portal/bundy`
- `/employee-portal/leave-request`
- `/employee-portal/payslips`

## Console Health

- No uncaught exceptions.
- No repeated auth/session errors.
- No hydration mismatch warnings on page load.

## Network Health

- No failed XHR/fetch on initial route load.
- No repeated polling loops causing request storms.
- Supabase requests return expected status codes (avoid 401/403 loops).

## CPU Profiling (Chrome DevTools)

1. Start profiling before entering heavy routes (`/payslips`, `/timesheet`, `/device-activity`).
2. Interact with main filters/forms for 20-30 seconds.
3. Stop profile and capture:
   - top hot functions by self time
   - long tasks > 50ms
   - expensive rerender bursts
4. Log findings to release notes for each profile session.

## Performance Budget (baseline targets)

- DOMContentLoaded < 8s on critical pages.
- Load event < 12s on critical pages.
- No persistent long-task spikes after first render.

## Action Rules

- **P0:** blocking exception, payroll calculation failure, broken approval action.
- **P1:** severe slowdown, repeated failed requests, route lockout for valid role.
- **P2:** visual inconsistency, minor accessibility polish, non-blocking warnings.

Ship only when P0/P1 findings are resolved or explicitly waived with documented owner/date.
