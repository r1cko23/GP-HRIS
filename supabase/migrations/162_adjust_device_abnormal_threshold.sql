-- =====================================================
-- 162: Adjust login device abnormal threshold (3+ devices)
-- =====================================================
-- Updates get_all_employees_devices so that:
-- - abnormal = TRUE when an employee has more than 2 devices (3 or more)
-- - comments reflect the new threshold
-- Login is still allowed; this is a monitoring/flag-only change.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_all_employees_devices()
RETURNS TABLE (
  employee_id UUID,
  employee_identifier TEXT,
  full_name TEXT,
  device_count BIGINT,
  last_seen_at TIMESTAMPTZ,
  device_labels TEXT,
  abnormal BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.employee_id AS employee_identifier,
    e.full_name,
    c.cnt AS device_count,
    maxd.last_seen_at,
    (SELECT string_agg(d.device_label, ', ' ORDER BY d.last_seen_at DESC)
     FROM public.employee_login_devices d WHERE d.employee_id = e.id) AS device_labels,
    (c.cnt > 2) AS abnormal  -- flag when 3+ devices
  FROM public.employees e
  JOIN LATERAL (
    SELECT count(*)::BIGINT AS cnt
    FROM public.employee_login_devices d
    WHERE d.employee_id = e.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT max(d.last_seen_at) AS last_seen_at
    FROM public.employee_login_devices d
    WHERE d.employee_id = e.id
  ) maxd ON true
  WHERE c.cnt > 0
  ORDER BY c.cnt DESC, maxd.last_seen_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_all_employees_devices() IS
  'Admin: list employees with at least one login device; device_count, last_seen, labels; abnormal = more than 2 devices (3+).';

