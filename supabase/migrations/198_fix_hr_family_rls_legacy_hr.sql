-- Fix RLS and helpers still checking legacy role 'hr' after Head-of-HR family migration.
-- Affects head_of_hr / hr_admin / hr_compben users (e.g. Merry Budiongan, Roxanne Ngo).

-- ---------------------------------------------------------------------------
-- Helpers: HR family can manage all employees for OT / FTL (Head of HR scope)
-- Leave manager-step remains assignment-scoped inside approve_leave_request().
-- ---------------------------------------------------------------------------
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

  IF v_user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_user_role = 'approver' OR public.is_hr_role_family(v_user_role) THEN
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

CREATE OR REPLACE FUNCTION public.can_user_manage_failure_to_log(p_employee_id uuid)
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

CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'You do not have permission to approve OT requests for this employee';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = v_user_id,
      account_manager_id = CASE
        WHEN v_role = 'approver' OR public.is_hr_role_family(v_role) THEN v_user_id
        ELSE account_manager_id
      END
  WHERE id = p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Leave requests: replace legacy hr role checks in RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/HR/Approvers can manage leave request" ON public.leave_requests;

CREATE POLICY "Admin/HR/Approvers can manage leave request" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR public.is_hr_role_family(get_user_role())
    OR (get_user_role() = 'approver' AND can_user_manage_leave_request(employee_id))
    OR (auth.uid() = employee_id AND status = 'pending')
  )
  WITH CHECK (
    (get_user_role() = 'admin' AND status = ANY (ARRAY['approved_by_manager', 'approved_by_hr', 'rejected', 'cancelled']))
    OR (
      public.is_hr_role_family(get_user_role())
      AND (
        status = ANY (ARRAY['approved_by_hr', 'rejected', 'cancelled'])
        OR (can_user_manage_leave_request(employee_id) AND status = 'approved_by_manager')
      )
    )
    OR (
      get_user_role() = 'approver'
      AND can_user_manage_leave_request(employee_id)
      AND status = ANY (ARRAY['approved_by_manager', 'rejected', 'cancelled'])
    )
    OR (auth.uid() = employee_id AND status = 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- Employee locations & related tables still using role IN (admin, hr)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_location_assignments_insert_admin_hr ON public.employee_location_assignments;
DROP POLICY IF EXISTS employee_location_assignments_update_admin_hr ON public.employee_location_assignments;
DROP POLICY IF EXISTS employee_location_assignments_delete_admin_hr ON public.employee_location_assignments;

CREATE POLICY employee_location_assignments_insert_admin_hr ON public.employee_location_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

CREATE POLICY employee_location_assignments_update_admin_hr ON public.employee_location_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

CREATE POLICY employee_location_assignments_delete_admin_hr ON public.employee_location_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

DROP POLICY IF EXISTS office_locations_insert_admin_hr ON public.office_locations;
DROP POLICY IF EXISTS office_locations_update_admin_hr ON public.office_locations;
DROP POLICY IF EXISTS office_locations_delete_admin_hr ON public.office_locations;

CREATE POLICY office_locations_insert_admin_hr ON public.office_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

CREATE POLICY office_locations_update_admin_hr ON public.office_locations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

CREATE POLICY office_locations_delete_admin_hr ON public.office_locations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.role = 'admin' OR public.is_hr_role_family(users.role))
    )
  );

DROP POLICY IF EXISTS "HR and Admin can manage employees" ON public.employees;

CREATE POLICY "HR and Admin can manage employees" ON public.employees
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Approvers/admin/hr can view all employee profile pictures" ON public.employees;

CREATE POLICY "Approvers/admin/hr can view all employee profile pictures" ON public.employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (
          users.role = 'admin'
          OR public.is_hr_role_family(users.role)
          OR users.role IN ('approver', 'viewer')
        )
    )
  );

DROP POLICY IF EXISTS "Admin/HR can manage time entries" ON public.time_clock_entries;

CREATE POLICY "Admin/HR can manage time entries" ON public.time_clock_entries
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON public.weekly_attendance;

CREATE POLICY "HR and Admin can manage attendance" ON public.weekly_attendance
  FOR ALL TO authenticated
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
