-- Portal schedule access required position ILIKE '%ACCOUNT SUPERVISOR%'.
-- Directory/CSM cards now write titles like 'As (18,070.00)' onto
-- public.employees.position, which locked every AS out of /employee-portal/schedule.

CREATE OR REPLACE FUNCTION public.is_account_supervisor_position(p_position text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_position IS NULL OR btrim(p_position) = '' THEN false
    WHEN upper(p_position) LIKE '%ACCOUNT SUPERVISOR%' THEN true
    WHEN upper(btrim(p_position)) = 'AS' THEN true
    WHEN upper(btrim(p_position)) LIKE 'AS %' THEN true
    WHEN upper(btrim(p_position)) LIKE 'AS(%' THEN true
    ELSE false
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_account_supervisor_position(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_employee_type_and_position(p_employee_uuid uuid)
RETURNS TABLE(employee_type text, "position" text, employee_id text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.employee_type::TEXT,
    -- Production portal still string-matches ACCOUNT SUPERVISOR. Keep that
    -- token on CSM "As (rate)" titles so schedule access works before the
    -- Next.js helper ships.
    CASE
      WHEN public.is_account_supervisor_position(e.position)
           AND COALESCE(e.position, '') NOT ILIKE '%ACCOUNT SUPERVISOR%'
      THEN 'ACCOUNT SUPERVISOR'
      ELSE e.position
    END,
    e.employee_id,
    e.full_name
  FROM public.employees e
  WHERE e.id = p_employee_uuid
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id uuid, p_week_start date)
RETURNS TABLE (
  id uuid,
  schedule_date date,
  start_time time,
  end_time time,
  tasks text,
  day_off boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_type TEXT;
  v_employee_position TEXT;
BEGIN
  SELECT e.employee_type, e.position
  INTO v_employee_type, v_employee_position
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF NOT (
    v_employee_type = 'client-based'
    AND public.is_account_supervisor_position(v_employee_position)
  ) THEN
    RAISE EXCEPTION 'Schedule access is restricted to client-based Account Supervisors only';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.tasks,
    COALESCE(s.day_off, false) AS day_off
  FROM public.employee_week_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_type_and_position(uuid) TO anon, authenticated;
