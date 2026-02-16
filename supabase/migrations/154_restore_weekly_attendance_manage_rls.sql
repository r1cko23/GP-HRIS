-- =====================================================
-- 154: Restore weekly_attendance manage RLS policy
-- =====================================================
-- Symptom:
-- - Timesheet auto-generate can fail with:
--   "new row violates row-level security policy for table weekly_attendance"
--
-- Cause:
-- - weekly_attendance currently has SELECT policy only; no INSERT/UPDATE/DELETE
--   policy, so writes are denied by default under RLS.
--
-- Fix:
-- - Recreate a strict manage policy for admin/hr and service_role.
-- =====================================================

DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON public.weekly_attendance;

CREATE POLICY "HR and Admin can manage attendance"
ON public.weekly_attendance
FOR ALL
USING (
  (SELECT auth.role()) = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
  )
)
WITH CHECK (
  (SELECT auth.role()) = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
  )
);