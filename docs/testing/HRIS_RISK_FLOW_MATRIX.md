# HRIS Risk Flow Matrix

This document inventories critical HRIS flows, current automation coverage, and rollout priority for reliability hardening.

## Risk Prioritization

| Priority | Domain | Core Routes | Why High Risk | Current Automated Coverage | Gap |
| --- | --- | --- | --- | --- | --- |
| P0 | Authentication + RBAC | `/login`, `/dashboard`, `/payslips`, `/leave-approval`, `/overtime-approval`, `/time-entries` | Incorrect gating exposes restricted salary/approval actions and breaks navigation | Partial (`tests/loan-creation.spec.ts` login only) | No deterministic role matrix tests |
| P0 | Payroll generation | `/payslips`, `/deductions`, `/bir-reports`, `/reports` | Direct financial impact (gross/net/tax/government deductions) | None (only unit calc coverage in `utils/__tests__`) | No end-to-end payroll assertions |
| P0 | Leave/OT/FTL approvals | `/leave-approval`, `/overtime-approval`, `/failure-to-log-approval` | Multi-step approval and role constraints are business-critical | None | No manager vs HR vs approver behavior tests |
| P1 | Time attendance lifecycle | `/employee-portal/bundy`, `/timesheet`, `/time-entries`, `/device-activity` | Entry integrity impacts payroll + audit trail | None | No clock-in/out to review flow test |
| P1 | Employee self-service | `/employee-portal/*` | Daily operations (requests, status tracking, schedule, payslip visibility) | Partial (`tests/leave-request-employee.spec.ts`) | Missing happy path + validation suite |
| P2 | People/Admin operations | `/employees`, `/schedules`, `/loans`, `/settings`, `/audit` | Back-office changes influence approvals/payroll setup | Partial (`tests/loan-creation.spec.ts`) | Incomplete create/update validation and accessibility checks |

## Existing Test Assets

- Playwright config: `playwright.config.ts` (single worker, local URL, html report).
- Existing specs:
  - `tests/leave-request-employee.spec.ts`
  - `tests/loan-creation.spec.ts`
- Unit test:
  - `utils/__tests__/payroll-calculator.test.ts`
- Manual and data-validation references:
  - `docs/COMPLETE_TESTING_SUMMARY.md`
  - `docs/testing/TEST_PAYROLL_DATA_GUIDE.md`

## Immediate Reliability Backlog

1. Build reusable Playwright auth + UI helpers and environment profiles.
2. Add stable selectors (`data-testid`) for shared navigation and high-use forms.
3. Implement smoke lane for login, RBAC, and key module availability.
4. Implement regression lane for payroll + approvals + attendance.
5. Add DevTools runtime/perf checklist with pass/fail criteria per critical route.

## Success Criteria

- Every P0 flow has at least one deterministic Playwright scenario.
- Role restrictions in middleware/hooks are covered by role-based UI assertions.
- Payroll screens have non-flaky checks for tax and deductions visibility/calculation states.
- No blocking console errors in critical routes during automated smoke runs.
