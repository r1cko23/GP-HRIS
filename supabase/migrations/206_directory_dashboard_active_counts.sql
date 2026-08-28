-- Executive dashboard: active Directory headcount overall + per client.
CREATE OR REPLACE FUNCTION directory.dashboard_employee_totals()
RETURNS TABLE(status text, employee_count bigint)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  SELECT e.status::text, count(*)::bigint AS employee_count
  FROM directory.employees e
  GROUP BY e.status;
$$;

CREATE OR REPLACE FUNCTION directory.dashboard_active_by_client()
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  client_id uuid,
  client_name text,
  active_count bigint
)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    c.id AS client_id,
    c.name AS client_name,
    count(*)::bigint AS active_count
  FROM directory.employees e
  JOIN directory.organizations o ON o.id = e.organization_id
  JOIN directory.clients c ON c.id = e.client_id
  WHERE e.status = 'active'
  GROUP BY o.id, o.name, c.id, c.name
  ORDER BY active_count DESC, c.name;
$$;

GRANT EXECUTE ON FUNCTION directory.dashboard_employee_totals() TO service_role;
GRANT EXECUTE ON FUNCTION directory.dashboard_active_by_client() TO service_role;

NOTIFY pgrst, 'reload schema';
