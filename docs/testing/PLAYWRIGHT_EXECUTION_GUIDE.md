# Playwright Execution Guide

This guide standardizes how to run HRIS smoke/regression suites locally and against staging-like environments.

## Test Lanes

- **Smoke (`@smoke`)**: fast validation for core system health.
- **Regression (`@regression`)**: deeper flow checks for payroll, approvals, RBAC, and runtime stability.

## Required Environment Variables

### Admin flows

- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`

### Employee flows

- `TEST_EMPLOYEE_ID`
- `TEST_EMPLOYEE_PASSWORD` (optional; defaults to employee ID when omitted)

### Approver RBAC flows

- `TEST_APPROVER_EMAIL`
- `TEST_APPROVER_PASSWORD`

### Base URL control

- `PLAYWRIGHT_BASE_URL` (default: `http://localhost:3000`)
- `PLAYWRIGHT_EXTERNAL_BASE_URL=1` (skip local webServer boot, for staging-like runs)

## Commands

- Local smoke: `npm run test:smoke`
- Local regression: `npm run test:regression`
- Staging smoke: `PLAYWRIGHT_BASE_URL=https://your-host npm run test:staging:smoke`
- Staging regression: `PLAYWRIGHT_BASE_URL=https://your-host npm run test:staging:regression`
- Interactive debugging: `npm run test:ui`

## Test Structure

- Config: `playwright.config.ts`
- Auth fixtures: `tests/fixtures/auth.ts`
- Environment helpers: `tests/fixtures/env.ts`
- Runtime helpers: `tests/helpers/runtime.ts`
- UI helpers: `tests/helpers/ui.ts`

## Triage Workflow

1. Re-run failing spec in isolation with headed mode.
2. Check HTML report (`playwright-report`) and inspect trace/video.
3. For runtime failures, prioritize:
   - console errors
   - failed network requests
   - role-routing mismatches
4. Confirm if failure is data/setup related or product regression.
5. Update test data fixtures or app selectors only after root cause is confirmed.

## Release Gate Recommendation

- **Required before release:**
  - `test:smoke` passes.
  - `test:regression` passes in staging-like environment.
  - No open P0/P1 runtime errors from `runtime-devtools.regression.spec.ts`.
