-- Head-of-HR family can perform manager-step leave approval for any employee
-- (HR final step was already company-wide). Fixes UI/RPC mismatch where HR saw
-- "Approve (Manager)" but RPC required OT group assignment.

CREATE OR REPLACE FUNCTION public.can_user_manage_leave_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true
  LIMIT 1;

  IF v_user_role = 'admin' OR public.is_hr_role_family(v_user_role) THEN
    RETURN TRUE;
  END IF;

  IF v_user_role = 'approver' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.employees e
      LEFT JOIN public.overtime_groups og ON og.id = e.overtime_group_id
      WHERE e.id = p_employee_id
        AND (
          e.overtime_approver_id = v_user_id
          OR og.approver_id = v_user_id
        )
    );
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_leave_request(p_request_id uuid, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  WHERE id = v_user_id AND is_active = true;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User role not found or user is inactive';
  END IF;

  IF p_level NOT IN ('manager', 'hr') THEN
    RAISE EXCEPTION 'Invalid approval level. Must be manager or hr';
  END IF;

  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status IN ('approved_by_hr', 'rejected', 'cancelled') THEN
    RETURN;
  END IF;

  v_effective_level := p_level;

  IF v_role = 'admin' THEN
    v_is_authorized := TRUE;
  ELSIF public.is_hr_role_family(v_role) THEN
    -- HR family: final step for everyone; manager step for everyone when pending
    IF v_req.status = 'approved_by_manager' AND p_level = 'hr' THEN
      v_is_authorized := TRUE;
      v_effective_level := 'hr';
    ELSIF v_req.status = 'pending' AND p_level = 'manager' THEN
      v_is_authorized := TRUE;
      v_effective_level := 'manager';
    ELSIF v_req.status = 'pending' AND p_level = 'hr' THEN
      RAISE EXCEPTION 'HR-level approval requires manager approval first';
    ELSE
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
        v_effective_level := CASE WHEN v_req.status = 'pending' THEN 'manager' ELSE 'hr' END;
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
      RAISE EXCEPTION 'Manager-level approval requires pending status';
    END IF;

    UPDATE public.leave_requests
    SET status = 'approved_by_manager',
        account_manager_id = v_user_id,
        account_manager_approved_at = NOW()
    WHERE id = p_request_id;
  ELSE
    IF v_req.status <> 'approved_by_manager' THEN
      RAISE EXCEPTION 'HR-level approval requires approved_by_manager status';
    END IF;

    UPDATE public.leave_requests
    SET status = 'approved_by_hr',
        hr_approved_by = v_user_id,
        hr_approved_at = NOW()
    WHERE id = p_request_id;
  END IF;
END;
$$;
