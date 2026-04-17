-- =====================================================
-- 178: HR role family (head_of_hr, hr_admin, hr_compben)
-- =====================================================
-- Adds three HR sub-roles with the same leave/RLS privileges as `hr`
-- where we explicitly branch on role. Extends users.role CHECK.
-- Assigns: Merry (hrlrelations@...) -> head_of_hr, April -> hr_compben,
-- Roxanne (known UUID) -> hr_admin.
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_hr_role_family(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(btrim(p_role), '') IN (
    'hr',
    'head_of_hr',
    'hr_admin',
    'hr_compben'
  );
$$;

COMMENT ON FUNCTION public.is_hr_role_family(text) IS
  'True for legacy hr and new HR sub-roles (head_of_hr, hr_admin, hr_compben).';

-- ---------------------------------------------------------------------------
-- users.role CHECK (include all roles used in app + legacy account_manager)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'admin',
      'hr',
      'head_of_hr',
      'hr_admin',
      'hr_compben',
      'approver',
      'viewer',
      'account_manager',
      'ot_approver',
      'ot_viewer'
    )
  );

-- ---------------------------------------------------------------------------
-- Leave approval (latest body from 165_sil_allotted_subtract_used.sql)
-- ---------------------------------------------------------------------------
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
  WHERE id = v_user_id AND is_active = true;
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
  END IF;
END;
$$;

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
  ELSIF public.is_hr_role_family(v_role) THEN
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

-- ---------------------------------------------------------------------------
-- OT approve/reject (152): allow full HR role family
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.overtime_requests;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL
     OR NOT (
       v_role IN ('approver', 'admin')
       OR public.is_hr_role_family(v_role)
     ) THEN
    RAISE EXCEPTION 'Only admins, approvers, and HR can approve OT requests';
  END IF;

  SELECT * INTO v_req FROM public.overtime_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN;
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'approver' THEN auth.uid() ELSE account_manager_id END
  WHERE id = p_request_id;

  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL
     OR NOT (
       v_role IN ('approver', 'admin')
       OR public.is_hr_role_family(v_role)
     ) THEN
    RAISE EXCEPTION 'Only admins, approvers, and HR can reject OT requests';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'approver' THEN auth.uid() ELSE account_manager_id END,
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- set_user_permissions: allow HR family to run ACL RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_permissions(
  p_target_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_actor_role := public.get_user_role();
  IF v_actor_role IS NULL
     OR (v_actor_role <> 'admin' AND NOT public.is_hr_role_family(v_actor_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role <> 'admin' THEN
    IF EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_target_user_id
        AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  UPDATE public.users
  SET permissions = p_permissions
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- OT visibility: admin + full HR family see all (restore 155 behavior over 153)
-- ---------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.can_user_view_ot_request(uuid) IS
  'Own OT; admin and HR family see all; approver/viewer assignment-scoped.';

-- ---------------------------------------------------------------------------
-- Payslips DELETE policy (114): extend HR family
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/HR can delete payslips" ON public.payslips;

CREATE POLICY "Admin/HR can delete payslips" ON public.payslips
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.is_active = true
        AND (
          users.role = 'admin'
          OR public.is_hr_role_family(users.role)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Seed role assignments (idempotent emails / known Roxanne UUID from migration 156)
-- ---------------------------------------------------------------------------
UPDATE public.users
SET role = 'head_of_hr',
    can_access_salary = true
WHERE lower(email) = lower('hrlrelations@greenpasture.ph');

UPDATE public.users
SET role = 'hr_compben',
    can_access_salary = true
WHERE lower(email) = lower('anngammad@greenpasture.ph');

UPDATE public.users
SET role = 'hr_admin',
    can_access_salary = COALESCE(can_access_salary, true)
WHERE id = '2c8dc5c8-24b8-49ee-b6b3-dfa43d848228';

-- ---------------------------------------------------------------------------
-- RLS: treat HR family like legacy `hr` wherever policies use (admin, hr)
-- (expressions from migration 040_rls_perf_refactor + payslips follow-ons)
-- ---------------------------------------------------------------------------
ALTER POLICY "HR/Admin can manage location assignments" ON public.employee_location_assignments
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can manage office locations" ON public.office_locations
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can view all failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can manage all failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can view all leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can manage all leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

-- Payslips INSERT/UPDATE: migration 114 uses permissive authenticated policies;
-- only DELETE remains Admin/HR (updated above).

ALTER POLICY "HR and Admin can manage attendance" ON public.weekly_attendance
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

ALTER POLICY "HR and Admin can manage employees" ON public.employees
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
        AND (role = 'admin' OR public.is_hr_role_family(role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
        AND (role = 'admin' OR public.is_hr_role_family(role))
    )
  );

ALTER POLICY "Admins, approvers, and HR can view OT requests" ON public.overtime_requests
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('approver', 'admin')
          OR public.is_hr_role_family(u.role)
        )
    )
  );

ALTER POLICY "Admins, approvers, and HR can manage OT requests" ON public.overtime_requests
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('approver', 'admin')
          OR public.is_hr_role_family(u.role)
        )
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('approver', 'admin')
          OR public.is_hr_role_family(u.role)
        )
    )
  );

ALTER POLICY "Admin/HR can manage time entries" ON public.time_clock_entries
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
        AND users.is_active = true
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
        AND users.is_active = true
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "Admin/HR can manage deductions" ON public.employee_deductions
  USING (
    public.get_user_role() = 'admin'
    OR public.is_hr_role_family(public.get_user_role())
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR public.is_hr_role_family(public.get_user_role())
  );

ALTER POLICY "Admin/HR can manage loans" ON public.employee_loans
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

ALTER POLICY "HR/Admin can manage cutoff allowances" ON public.cutoff_allowances
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );
