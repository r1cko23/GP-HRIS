-- =====================================================
-- 153: Fix employee OT visibility and timesheet OT mapping
-- =====================================================
-- Issue:
-- - can_user_view_ot_request() no longer allowed employees to view their own OT.
-- - Employee Time Attendance OT column depends on reading approved overtime_requests.
--
-- Fix:
-- - Allow authenticated users to view their own OT requests.
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_user_view_ot_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Employees can always view their own OT requests.
  IF p_employee_id = v_user_id THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true
  LIMIT 1;

  -- Admin can view all.
  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- HR, Approver, Viewer: assigned employees/groups only.
  IF v_user_role IN ('hr', 'approver', 'viewer') THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.employees e
      LEFT JOIN public.overtime_groups og ON og.id = e.overtime_group_id
      WHERE e.id = p_employee_id
        AND (
          e.overtime_approver_id = v_user_id
          OR e.overtime_viewer_id = v_user_id
          OR og.approver_id = v_user_id
          OR og.viewer_id = v_user_id
        )
    );
  END IF;

  RETURN FALSE;
END;
$function$;

COMMENT ON FUNCTION public.can_user_view_ot_request(uuid)
IS 'Allows employees to view own OT requests; admin can view all; HR/approver/viewer can view assigned employees/groups only.';
