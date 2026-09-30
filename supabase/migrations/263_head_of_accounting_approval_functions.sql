-- Wire Head of accounting into the group-scoped OT, leave, and failure-to-log checks.
-- She follows the approver branch (her overtime group), not the HR "see everyone" branch.

CREATE OR REPLACE FUNCTION public.can_user_view_leave_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF public.is_group_queue_role(v_user_role) THEN
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
$$;

CREATE OR REPLACE FUNCTION public.can_user_view_ot_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_employee_id = v_user_id THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true
  LIMIT 1;

  IF v_user_role = 'admin' OR public.is_hr_role_family(v_user_role) THEN
    RETURN TRUE;
  END IF;

  IF public.is_group_queue_role(v_user_role) THEN
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
$$;

CREATE OR REPLACE FUNCTION public.can_user_view_failure_to_log(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF public.is_group_queue_role(v_user_role) THEN
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
$$;

CREATE OR REPLACE FUNCTION public.can_user_manage_leave_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF public.is_group_approver_role(v_user_role) OR public.is_hr_role_family(v_user_role) THEN
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

CREATE OR REPLACE FUNCTION public.can_user_manage_ot_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF public.is_group_approver_role(v_user_role) THEN
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

CREATE OR REPLACE FUNCTION public.can_user_manage_overtime_request(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF public.is_group_approver_role(v_user_role) THEN
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

CREATE OR REPLACE FUNCTION public.can_user_manage_failure_to_log(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

  IF public.is_group_approver_role(v_user_role) THEN
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

CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_req public.overtime_requests;
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
  FROM public.overtime_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status = 'approved' THEN
    RETURN;
  END IF;

  IF v_role = 'admin' OR public.is_hr_role_family(v_role) THEN
    v_is_authorized := TRUE;
  ELSIF public.is_group_approver_role(v_role) THEN
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
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'You do not have permission to approve OT requests for this employee';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = v_user_id,
      account_manager_id = CASE
        WHEN public.is_group_approver_role(v_role) OR public.is_hr_role_family(v_role) THEN v_user_id
        ELSE account_manager_id
      END
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_request_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL
     OR NOT (
       v_role = 'admin'
       OR public.is_group_approver_role(v_role)
       OR public.is_hr_role_family(v_role)
     ) THEN
    RAISE EXCEPTION 'Only admins, approvers, and HR can reject OT requests';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE
        WHEN public.is_group_approver_role(v_role) OR public.is_hr_role_family(v_role) THEN auth.uid()
        ELSE account_manager_id
      END,
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_leave_request(p_request_id uuid, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
    IF v_req.status = 'approved_by_manager' AND p_level = 'hr' THEN
      v_is_authorized := TRUE;
      v_effective_level := 'hr';
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
  ELSIF public.is_group_approver_role(v_role) THEN
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

CREATE OR REPLACE FUNCTION public.reject_leave_request(p_request_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
    RAISE EXCEPTION 'User role not found or user is inactive';
  END IF;

  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_role = 'admin' OR public.is_hr_role_family(v_role) THEN
    v_is_authorized := TRUE;
  ELSIF public.is_group_approver_role(v_role) THEN
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

ALTER POLICY "Admin/HR/Approvers can manage leave request"
ON public.leave_requests
USING (
  (get_user_role() = 'admin'::text)
  OR is_hr_role_family(get_user_role())
  OR (
    public.is_group_approver_role(get_user_role())
    AND can_user_manage_leave_request(employee_id)
  )
  OR ((auth.uid() = employee_id) AND (status = 'pending'::text))
)
WITH CHECK (
  (
    (get_user_role() = 'admin'::text)
    AND (status = ANY (ARRAY['approved_by_manager'::text, 'approved_by_hr'::text, 'rejected'::text, 'cancelled'::text]))
  )
  OR (
    is_hr_role_family(get_user_role())
    AND (
      (status = ANY (ARRAY['approved_by_hr'::text, 'rejected'::text, 'cancelled'::text]))
      OR (can_user_manage_leave_request(employee_id) AND (status = 'approved_by_manager'::text))
    )
  )
  OR (
    public.is_group_approver_role(get_user_role())
    AND can_user_manage_leave_request(employee_id)
    AND (status = ANY (ARRAY['approved_by_manager'::text, 'rejected'::text, 'cancelled'::text]))
  )
  OR ((auth.uid() = employee_id) AND (status = 'cancelled'::text))
);
