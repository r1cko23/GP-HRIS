-- Ensure Head-of-HR family cannot see Admin module pages by default.
-- Keeps admin modules reserved for role=admin unless explicitly changed by future policy.

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      "audit": {"create": false, "read": false, "update": false, "delete": false},
      "bir_reports": {"create": false, "read": false, "update": false, "delete": false},
      "reports": {"create": false, "read": false, "update": false, "delete": false},
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
$function$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      WHEN 'read' THEN p_module IN ('dashboard', 'employees', 'schedules', 'loans', 'payslips', 'timesheet', 'time_entries', 'leave_approval', 'overtime_approval', 'failure_to_log', 'settings')
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
$function$;
