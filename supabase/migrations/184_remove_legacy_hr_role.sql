-- Remove legacy `hr` role and fully migrate to Head-of-HR role family.
-- Canonical HR-family roles:
--   - head_of_hr
--   - hr_admin
--   - hr_compben

-- 1) Convert any remaining legacy rows.
UPDATE public.users
SET role = 'head_of_hr'
WHERE role = 'hr';

-- 2) Enforce role constraint without legacy `hr`.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'admin',
      'head_of_hr',
      'hr_admin',
      'hr_compben',
      'approver',
      'viewer',
      'employee',
      'account_manager',
      'ot_approver',
      'ot_viewer'
    )
  );

-- 3) HR-family helper now excludes legacy `hr`.
CREATE OR REPLACE FUNCTION public.is_hr_role_family(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(btrim(p_role), '') IN (
    'head_of_hr',
    'hr_admin',
    'hr_compben'
  );
$$;

-- 4) Keep function name for compatibility, but include head_of_hr family.
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND is_active = true
      AND (
        role = 'admin'
        OR public.is_hr_role_family(role)
      )
  );
$$;

-- 5) Failure-to-log helper functions should use HR-family helper.
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

CREATE OR REPLACE FUNCTION public.can_user_view_failure_to_log(p_employee_id uuid)
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
$$;

-- 6) ACL defaults and checks should no longer branch on legacy `hr`.
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
  v_custom_permissions JSONB;
  v_default_permissions JSONB;
  v_merged_permissions JSONB;
BEGIN
  SELECT role, permissions INTO v_role, v_custom_permissions
  FROM public.users
  WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  v_default_permissions := CASE
    WHEN v_role = 'admin' THEN '{
      "dashboard": {"create": true, "read": true, "update": true, "delete": true},
      "employees": {"create": true, "read": true, "update": true, "delete": true},
      "schedules": {"create": true, "read": true, "update": true, "delete": true},
      "loans": {"create": true, "read": true, "update": true, "delete": true},
      "payslips": {"create": true, "read": true, "update": true, "delete": true},
      "timesheet": {"create": true, "read": true, "update": true, "delete": true},
      "time_entries": {"create": true, "read": true, "update": true, "delete": true},
      "leave_approval": {"create": true, "read": true, "update": true, "delete": true},
      "overtime_approval": {"create": true, "read": true, "update": true, "delete": true},
      "failure_to_log": {"create": true, "read": true, "update": true, "delete": true},
      "audit": {"create": true, "read": true, "update": true, "delete": true},
      "bir_reports": {"create": true, "read": true, "update": true, "delete": true},
      "reports": {"create": true, "read": true, "update": true, "delete": true},
      "settings": {"create": true, "read": true, "update": true, "delete": true},
      "user_management": {"create": true, "read": true, "update": true, "delete": true}
    }'::JSONB
    WHEN public.is_hr_role_family(v_role) THEN '{
      "dashboard": {"create": false, "read": true, "update": false, "delete": false},
      "employees": {"create": true, "read": true, "update": true, "delete": false},
      "schedules": {"create": true, "read": true, "update": true, "delete": true},
      "loans": {"create": true, "read": true, "update": true, "delete": false},
      "payslips": {"create": true, "read": true, "update": true, "delete": false},
      "timesheet": {"create": false, "read": true, "update": true, "delete": false},
      "time_entries": {"create": true, "read": true, "update": true, "delete": true},
      "leave_approval": {"create": false, "read": true, "update": true, "delete": false},
      "overtime_approval": {"create": false, "read": true, "update": true, "delete": false},
      "failure_to_log": {"create": false, "read": true, "update": true, "delete": false},
      "audit": {"create": false, "read": true, "update": false, "delete": false},
      "bir_reports": {"create": false, "read": true, "update": false, "delete": false},
      "reports": {"create": false, "read": true, "update": false, "delete": false},
      "settings": {"create": false, "read": true, "update": false, "delete": false},
      "user_management": {"create": false, "read": false, "update": false, "delete": false}
    }'::JSONB
    WHEN v_role = 'approver' THEN '{
      "dashboard": {"create": false, "read": false, "update": false, "delete": false},
      "employees": {"create": false, "read": true, "update": false, "delete": false},
      "schedules": {"create": false, "read": true, "update": false, "delete": false},
      "loans": {"create": false, "read": false, "update": false, "delete": false},
      "payslips": {"create": false, "read": false, "update": false, "delete": false},
      "timesheet": {"create": false, "read": true, "update": false, "delete": false},
      "time_entries": {"create": false, "read": true, "update": false, "delete": false},
      "leave_approval": {"create": false, "read": true, "update": true, "delete": false},
      "overtime_approval": {"create": false, "read": true, "update": true, "delete": false},
      "failure_to_log": {"create": false, "read": true, "update": true, "delete": false},
      "audit": {"create": false, "read": false, "update": false, "delete": false},
      "bir_reports": {"create": false, "read": false, "update": false, "delete": false},
      "reports": {"create": false, "read": false, "update": false, "delete": false},
      "settings": {"create": false, "read": false, "update": false, "delete": false},
      "user_management": {"create": false, "read": false, "update": false, "delete": false}
    }'::JSONB
    WHEN v_role = 'viewer' THEN '{
      "dashboard": {"create": false, "read": false, "update": false, "delete": false},
      "employees": {"create": false, "read": true, "update": false, "delete": false},
      "schedules": {"create": false, "read": true, "update": false, "delete": false},
      "loans": {"create": false, "read": false, "update": false, "delete": false},
      "payslips": {"create": false, "read": false, "update": false, "delete": false},
      "timesheet": {"create": false, "read": true, "update": false, "delete": false},
      "time_entries": {"create": false, "read": true, "update": false, "delete": false},
      "leave_approval": {"create": false, "read": true, "update": false, "delete": false},
      "overtime_approval": {"create": false, "read": true, "update": false, "delete": false},
      "failure_to_log": {"create": false, "read": true, "update": false, "delete": false},
      "audit": {"create": false, "read": false, "update": false, "delete": false},
      "bir_reports": {"create": false, "read": false, "update": false, "delete": false},
      "reports": {"create": false, "read": false, "update": false, "delete": false},
      "settings": {"create": false, "read": false, "update": false, "delete": false},
      "user_management": {"create": false, "read": false, "update": false, "delete": false}
    }'::JSONB
    ELSE '{}'::JSONB
  END;

  IF v_custom_permissions IS NOT NULL THEN
    v_merged_permissions := v_default_permissions || v_custom_permissions;
  ELSE
    v_merged_permissions := v_default_permissions;
  END IF;

  RETURN v_merged_permissions;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_permissions(
  p_target_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      SELECT 1
      FROM public.users
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

CREATE OR REPLACE FUNCTION public.set_user_salary_access(
  p_target_user_id uuid,
  p_can_access_salary boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_actor_role := public.get_user_role();
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role <> 'admin' AND NOT public.is_hr_role_family(v_actor_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role <> 'admin' AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_target_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.users
  SET can_access_salary = p_can_access_salary
  WHERE id = p_target_user_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id uuid,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
  v_module_perms JSONB;
BEGIN
  SELECT role, permissions INTO v_role, v_permissions
  FROM public.users
  WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_permissions IS NOT NULL AND v_permissions ? p_module THEN
    v_module_perms := v_permissions->p_module;
    IF v_module_perms ? p_action THEN
      RETURN (v_module_perms->>p_action)::BOOLEAN;
    END IF;
  END IF;

  IF public.is_hr_role_family(v_role) THEN
    RETURN CASE p_action
      WHEN 'create' THEN p_module IN ('employees', 'schedules', 'loans', 'time_entries', 'leave_approval', 'overtime_approval', 'failure_to_log')
      WHEN 'read' THEN TRUE
      WHEN 'update' THEN p_module IN ('employees', 'schedules', 'loans', 'timesheet', 'time_entries', 'leave_approval', 'overtime_approval', 'failure_to_log')
      WHEN 'delete' THEN p_module IN ('schedules', 'time_entries')
      ELSE FALSE
    END;
  END IF;

  IF v_role = 'approver' THEN
    RETURN CASE p_action
      WHEN 'read' THEN p_module IN ('timesheet', 'time_entries', 'leave_approval', 'overtime_approval', 'failure_to_log', 'employees')
      WHEN 'update' THEN p_module IN ('leave_approval', 'overtime_approval', 'failure_to_log')
      ELSE FALSE
    END;
  END IF;

  IF v_role = 'viewer' THEN
    RETURN p_action = 'read'
      AND p_module IN ('timesheet', 'time_entries', 'leave_approval', 'overtime_approval', 'failure_to_log', 'employees');
  END IF;

  RETURN FALSE;
END;
$$;

-- 7) Password reset authorization should follow admin + HR-family.
CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_user_id uuid,
  p_new_password text,
  p_reset_by uuid
)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resetter_role TEXT;
  v_password_hash TEXT;
BEGIN
  SELECT role INTO v_resetter_role
  FROM public.users
  WHERE id = p_reset_by
    AND is_active = true;

  IF v_resetter_role IS NULL
     OR (v_resetter_role <> 'admin' AND NOT public.is_hr_role_family(v_resetter_role)) THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized. Only admin or Head of HR family can reset passwords.'::TEXT;
    RETURN;
  END IF;

  IF LENGTH(TRIM(p_new_password)) < 6 THEN
    RETURN QUERY SELECT FALSE, 'Password must be at least 6 characters long'::TEXT;
    RETURN;
  END IF;

  v_password_hash := crypt(p_new_password, gen_salt('bf', 10));

  UPDATE public.users
  SET
    password_hash = v_password_hash,
    password_reset_token = NULL,
    password_reset_expires = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
