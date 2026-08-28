-- Headcounts and dashboard metrics use current engagement only (roster_current semantics).

CREATE OR REPLACE FUNCTION directory.client_employee_counts(p_org uuid)
RETURNS TABLE(client_id uuid, employee_count bigint)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  SELECT e.client_id, count(*)::bigint AS employee_count
  FROM directory.employees e
  WHERE e.organization_id = p_org
    AND e.is_current_engagement = true
  GROUP BY e.client_id;
$$;

CREATE OR REPLACE FUNCTION directory.dashboard_employee_totals()
RETURNS TABLE(status text, employee_count bigint)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  SELECT e.status::text, count(*)::bigint AS employee_count
  FROM directory.employees e
  WHERE e.is_current_engagement = true
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
    AND e.is_current_engagement = true
  GROUP BY o.id, o.name, c.id, c.name
  ORDER BY active_count DESC, c.name;
$$;

GRANT SELECT ON directory.roster_current TO service_role;

NOTIFY pgrst, 'reload schema';
