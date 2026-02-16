-- =====================================================
-- 155: Allow HR to view all OT requests
-- =====================================================
-- Reason:
-- - Time Attendance allows HR to view all employees.
-- - OT hours on that page are sourced from overtime_requests.
-- - If HR OT visibility is assignment-scoped, OT column appears blank for many employees.
--
-- This keeps approver/viewer assignment scoping intact while allowing HR full OT read.
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

  -- Admin and HR can view all.
  IF v_user_role IN ('admin', 'hr') THEN
    RETURN TRUE;
  END IF;

  -- Approver, Viewer: assigned employees/groups only.
  IF v_user_role IN ('approver', 'viewer') THEN
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
IS 'Employees can view own OT; admin/hr can view all; approver/viewer are assignment-scoped.';