-- =====================================================
-- 160: HR can approve/reject ALL leave requests at second step (HR level)
-- =====================================================
-- Previously approve_leave_request only allowed HR to act on employees in their
-- OT group or with them as direct approver. April and Roxanne (HR) should be
-- secondary approvers for ALL employees: any HR can approve approved_by_manager -> approved_by_hr.
-- At manager level (pending), HR still only for their assigned employees.
-- =====================================================

CREATE OR REPLACE FUNCTION public.approve_leave_request(p_request_id UUID, p_level TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.leave_requests;
  v_role TEXT;
  v_user_id UUID;
  v_employee_group_id UUID;
  v_employee_approver_id UUID;
  v_group_approver_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_effective_level TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User role not found or user is inactive. User ID: %', v_user_id;
  END IF;

  IF p_level NOT IN ('manager', 'hr') THEN
    RAISE EXCEPTION 'Invalid approval level. Must be "manager" or "hr"';
  END IF;

  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  IF v_req.status IN ('approved_by_hr', 'rejected', 'cancelled') THEN
    RETURN;
  END IF;

  v_effective_level := p_level;

  IF v_role = 'admin' THEN
    v_is_authorized := TRUE;

  ELSIF v_role = 'hr' THEN
    -- HR can ALWAYS approve at HR level (second step) for ANY employee
    IF v_req.status = 'approved_by_manager' AND p_level = 'hr' THEN
      v_is_authorized := TRUE;
      v_effective_level := 'hr';
    ELSE
      -- At manager level (pending), only if assigned as approver for this employee
      SELECT e.overtime_group_id, e.overtime_approver_id
        INTO v_employee_group_id, v_employee_approver_id
      FROM public.employees e
      WHERE e.id = v_req.employee_id;

      IF v_employee_approver_id = v_user_id THEN
        v_is_authorized := TRUE;
      ELSIF v_employee_group_id IS NOT NULL THEN
        SELECT og.approver_id INTO v_group_approver_id
        FROM public.overtime_groups og
        WHERE og.id = v_employee_group_id;
        IF v_group_approver_id = v_user_id THEN
          v_is_authorized := TRUE;
        END IF;
      END IF;

      IF v_is_authorized THEN
        IF v_req.status = 'pending' THEN
          v_effective_level := 'manager';
        ELSE
          v_effective_level := 'hr';
        END IF;
      END IF;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'You do not have permission to approve leave requests for this employee';
    END IF;

  ELSIF v_role = 'approver' THEN
    SELECT e.overtime_group_id, e.overtime_approver_id
      INTO v_employee_group_id, v_employee_approver_id
    FROM public.employees e
    WHERE e.id = v_req.employee_id;

    IF v_employee_approver_id = v_user_id THEN
      v_is_authorized := TRUE;
    ELSIF v_employee_group_id IS NOT NULL THEN
      SELECT og.approver_id INTO v_group_approver_id
      FROM public.overtime_groups og
      WHERE og.id = v_employee_group_id;
      IF v_group_approver_id = v_user_id THEN
        v_is_authorized := TRUE;
      END IF;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'You do not have permission to approve leave requests for this employee';
    END IF;

    v_effective_level := 'manager';

  ELSE
    RAISE EXCEPTION 'Only admins, HR, and approvers can approve leave requests. Current role: %', v_role;
  END IF;

  IF v_effective_level = 'manager' THEN
    IF v_req.status <> 'pending' THEN
      RAISE EXCEPTION 'Manager-level approval requires pending status. Current status: %', v_req.status;
    END IF;

    UPDATE public.leave_requests
    SET status = 'approved_by_manager',
        account_manager_id = v_user_id,
        account_manager_approved_at = NOW()
    WHERE id = p_request_id;
  ELSE
    IF v_req.status <> 'approved_by_manager' THEN
      RAISE EXCEPTION 'HR-level approval requires approved_by_manager status. Current status: %', v_req.status;
    END IF;

    UPDATE public.leave_requests
    SET status = 'approved_by_hr',
        hr_approved_by = v_user_id,
        hr_approved_at = NOW()
    WHERE id = p_request_id;

    IF v_req.leave_type = 'SIL' THEN
      UPDATE public.employees
      SET sil_credits = GREATEST(0, COALESCE(sil_credits, 0) - v_req.total_days)
      WHERE id = v_req.employee_id;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.approve_leave_request(UUID, TEXT) IS
  'Two-step leave approval. Admin can do both steps. HR can do second step (approved_by_manager -> approved_by_hr) for ALL employees; at manager step only for assigned. Approver only manager step for assigned.';

-- Same fix for reject: HR can reject any leave request (not only assigned)
CREATE OR REPLACE FUNCTION public.reject_leave_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.leave_requests;
  v_role TEXT;
  v_user_id UUID;
  v_employee_group_id UUID;
  v_employee_approver_id UUID;
  v_group_approver_id UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User role not found or user is inactive. User ID: %', v_user_id;
  END IF;

  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  IF v_role = 'admin' THEN
    v_is_authorized := TRUE;
  ELSIF v_role = 'hr' THEN
    -- HR can reject any leave request (same scope as HR approval)
    v_is_authorized := TRUE;
  ELSIF v_role = 'approver' THEN
    SELECT e.overtime_group_id, e.overtime_approver_id
      INTO v_employee_group_id, v_employee_approver_id
    FROM public.employees e
    WHERE e.id = v_req.employee_id;

    IF v_employee_approver_id = v_user_id THEN
      v_is_authorized := TRUE;
    ELSIF v_employee_group_id IS NOT NULL THEN
      SELECT og.approver_id INTO v_group_approver_id
      FROM public.overtime_groups og
      WHERE og.id = v_employee_group_id;
      IF v_group_approver_id = v_user_id THEN
        v_is_authorized := TRUE;
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Only admins, HR, and approvers can reject leave requests. Current role: %', v_role;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'You do not have permission to reject leave requests for this employee';
  END IF;

  UPDATE public.leave_requests
  SET status = 'rejected',
      rejected_by = v_user_id,
      rejected_at = NOW(),
      rejection_reason = COALESCE(rejection_reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

COMMENT ON FUNCTION public.reject_leave_request(UUID, TEXT) IS
  'Reject leave request. Admin and HR can reject any; approver only for assigned employees.';
