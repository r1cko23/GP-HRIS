-- Possible duplicate queue is current engagements only.
-- Parked extras stay on file but must not keep the live 201 in the review list.

CREATE OR REPLACE FUNCTION directory.duplicate_review_ids(
  p_org uuid,
  p_client uuid DEFAULT NULL
)
RETURNS TABLE (employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = directory
AS $$
  WITH split AS (
    SELECT e.id
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND e.person_key IS NOT NULL
      AND (p_client IS NULL OR e.client_id = p_client)
      AND e.person_key IN (
        SELECT person_key
        FROM directory.employees
        WHERE organization_id = p_org
          AND person_key IS NOT NULL
        GROUP BY person_key
        HAVING count(*) FILTER (WHERE is_current_engagement) > 1
      )
  ),
  sss_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT directory.sss_digits(sss_number) AS digits
      FROM directory.employees
      WHERE organization_id = p_org
        AND directory.sss_usable(sss_number)
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.sss_digits(e.sss_number)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND (p_client IS NULL OR e.client_id = p_client)
  ),
  name_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT
        upper(trim(last_name)) AS ln,
        upper(trim(first_name)) AS fn,
        birth_date
      FROM directory.employees
      WHERE organization_id = p_org
        AND is_current_engagement
        AND birth_date IS NOT NULL
        AND coalesce(trim(last_name), '') <> ''
        AND coalesce(trim(first_name), '') <> ''
      GROUP BY 1, 2, 3
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d
      ON d.ln = upper(trim(e.last_name))
     AND d.fn = upper(trim(e.first_name))
     AND d.birth_date = e.birth_date
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND (p_client IS NULL OR e.client_id = p_client)
  )
  SELECT DISTINCT id FROM split
  UNION
  SELECT DISTINCT id FROM sss_dups
  UNION
  SELECT DISTINCT id FROM name_dups;
$$;
