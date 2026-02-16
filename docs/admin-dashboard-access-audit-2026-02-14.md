# Admin Dashboard Access Audit (2026-02-14)

## Scope
- Frontend route/page gating for admin-dashboard users (`admin`, `hr`, `approver`, `viewer`).
- DB authorization for key modules: `overtime_requests`, `leave_requests`, `failure_to_log`.
- Spot-check of high-risk payroll/time tables and SECURITY DEFINER RPCs.
- Goal: identify what each role can **see / approve / update / delete**, plus corrective actions.

## Method
- Code audit of route/page logic and middleware.
- Live Supabase policy/function checks via MCP.
- Runtime permission simulation using helper functions:
  - `can_user_view_*`
  - `can_user_manage_*`
- Transactional behavior tests for assigned vs unassigned approval paths.

## Roles Found In Production
- `admin`: active
- `hr`: active
- `approver`: active
- `viewer`: **no active user record found** (cannot fully runtime-test viewer UX)

## Current Role Matrix (Admin Dashboard)

| Area | Admin | HR | Approver | Viewer |
|---|---|---|---|---|
| `/dashboard` | Full | Workforce view | Redirect to approval flows | Redirect to approval flows |
| `/overtime-approval` | View/approve/reject | View/approve/reject (assigned scope) | View/approve/reject (assigned scope) | View only (assigned scope) |
| `/leave-approval` | View/approve/reject | View/approve/reject (assigned scope; includes manager + HR stage logic) | View/approve/reject manager stage (assigned scope) | View only (assigned scope) |
| `/failure-to-log-approval` | View/approve/reject | View/approve/reject (assigned scope) | View/approve/reject (assigned scope) | View only (assigned scope) |
| Employee filter dropdown (OT/Leave/FTL pages) | All employees | Assigned employees only | Assigned employees only | Assigned employees only |

## Core Permission Tests (Live)

### Assigned vs Unassigned checks (Roxanne and Michelle)
- `can_user_manage_overtime_request`:
  - assigned employee: `true`
  - unassigned employee: `false`
- `can_user_manage_leave_request`:
  - assigned employee: `true`
  - unassigned employee: `false`
- `can_user_manage_failure_to_log`:
  - assigned employee: `true`
  - unassigned employee: `false`
- `can_user_view_*` helpers follow the same assigned/unassigned behavior.

### Admin checks
- Admin helper checks return global access (`true`) for view/manage across OT/Leave/FTL.

## Fixes Already Applied During This Audit Cycle
- Reverted problematic OT-manage policy dependency to stable behavior.
- Enforced assignment-scoped OT/Leave/FTL manage logic in core approval RPCs.
- Fixed `approve_overtime_request` runtime failure (`offset_hours` removed).
- Assigned `HR & ADMIN` group approver to Roxanne.
- Restricted HR visibility to assigned scope in OT/Leave/FTL.
- Removed legacy broad `failure_to_log` SELECT policies and replaced with assignment-scoped policy.
- Updated frontend employee filter loaders (OT/Leave/FTL) so non-admin roles only get assigned employees.

## High-Risk Findings Still Present (Needs Fix)

1. **Payslips RLS too broad**
   - Current live policies include:
     - `All authenticated users can view payslips`
     - `All authenticated users can create payslips`
     - `All authenticated users can update payslips`
   - Risk: any authenticated user can view/modify payroll records.

2. **Employees SELECT too broad**
   - Current policy: `All authenticated users can view employees`.
   - Risk: users can enumerate all employees at DB/API layer even if UI hides data.

3. **Time entries SELECT too broad**
   - Current policy allows broad read (including anon/auth patterns).
   - Risk: clock/time data exposure beyond intended roles.

4. **Deductions SELECT too broad**
   - Current policy: `All authenticated users can view deductions`.
   - Risk: sensitive compensation data leakage.

5. **Weekly attendance SELECT too broad**
   - Current policy: all authenticated users can view.
   - Risk: payroll-adjacent data exposure.

6. **SECURITY DEFINER RPCs trust caller-provided employee IDs**
   - `create_leave_request`, `create_overtime_request`, `get_my_leave_requests`, `get_employee_payslips`.
   - Risk: if called directly, user may access/create for other employees unless app-layer fully protects.

## Recommended Next Fix Order

### Priority P0 (immediate)
- Tighten `payslips` RLS to admin/authorized HR only (+ scoped employee self-read if required).
- Tighten `employee_deductions`, `weekly_attendance`, `time_clock_entries` SELECT policies to least privilege.

### Priority P1
- Tighten `employees` SELECT policy to role/assignment scope.
- Add strict caller validation inside SECURITY DEFINER RPCs:
  - enforce employee ownership or approved role before using `p_employee_id` params.

### Priority P2
- Add a seeded active `viewer` test account for full regression testing.
- Add automated permission regression tests (SQL + Playwright smoke checks).

## Suggested Regression Checklist (per release)
- Login as each role (`admin`, `hr`, `approver`, `viewer`).
- For OT/Leave/FTL:
  - can only see assigned employees in list/filter.
  - can approve assigned requests.
  - cannot approve unassigned requests.
- For payroll pages:
  - unauthorized roles cannot read/update via UI and direct REST calls.

---

If you want, next step is I can implement the **P0 hardening migration set** (payslips/deductions/time entries/weekly attendance) in one controlled pass, with before/after verification queries.

