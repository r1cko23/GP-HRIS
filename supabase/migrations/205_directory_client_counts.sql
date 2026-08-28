-- Headcounts for the Directory client picker (one round-trip per org).
CREATE OR REPLACE FUNCTION directory.client_employee_counts(p_org uuid)
RETURNS TABLE(client_id uuid, employee_count bigint)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  SELECT e.client_id, count(*)::bigint AS employee_count
  FROM directory.employees e
  WHERE e.organization_id = p_org
  GROUP BY e.client_id;
$$;

GRANT EXECUTE ON FUNCTION directory.client_employee_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
