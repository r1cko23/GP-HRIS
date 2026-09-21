-- Strip trailing numeric-only rate suffixes from Directory job titles
-- (e.g. "As (18,070.00)" → "Account Supervisor", "Server (695)" → "Server").
-- Keep site/note parentheses. Expand bare AS → Account Supervisor.
-- Unblock client-based Account Supervisors on /employee-portal/schedule
-- (live get_my_week_schedule still required ILIKE '%ACCOUNT SUPERVISOR%').

CREATE OR REPLACE FUNCTION directory.normalize_job_title(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL OR btrim(v) = '' THEN NULL
    ELSE (
      WITH cleaned AS (
        SELECT btrim(regexp_replace(btrim(v), '\s+', ' ', 'g')) AS t
      ),
      stripped AS (
        SELECT NULLIF(
          btrim(
            regexp_replace(
              t,
              '\s*\(\s*[0-9]{1,3}(,[0-9]{3})*(\.[0-9]+)?\s*\)\s*$',
              '',
              ''
            )
          ),
          ''
        ) AS t
        FROM cleaned
      )
      SELECT CASE
        WHEN t IS NULL THEN NULL
        WHEN upper(regexp_replace(replace(t, '.', ''), '\s+', '', 'g')) IN (
          'AS',
          'ACCOUNTSUPERVISOR'
        ) THEN 'Account Supervisor'
        ELSE t
      END
      FROM stripped
    )
  END;
$$;

COMMENT ON FUNCTION directory.normalize_job_title(text) IS
  'Strip trailing numeric rate parentheses; expand bare AS to Account Supervisor. Keep site/note parentheses.';

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

-- Directory position cards: strip rate suffixes and expand AS.
UPDATE directory.positions
SET
  job_title = directory.normalize_job_title(job_title),
  updated_at = now()
WHERE job_title IS DISTINCT FROM directory.normalize_job_title(job_title);

-- Office roster: prefer the cleaned card title when linked; else normalize free text.
UPDATE public.employees e
SET
  position = directory.normalize_job_title(p.job_title),
  updated_at = now()
FROM directory.positions p
WHERE e.position_id = p.id
  AND e.position IS DISTINCT FROM directory.normalize_job_title(p.job_title);

UPDATE public.employees
SET
  position = directory.normalize_job_title(position),
  updated_at = now()
WHERE position_id IS NULL
  AND position IS DISTINCT FROM directory.normalize_job_title(position);
