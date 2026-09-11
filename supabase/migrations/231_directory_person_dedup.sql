-- Person-file cleaning helpers: SSS lookup + duplicate-review queue.
-- Does not delete 201 rows. Extra files stay superseded.

CREATE OR REPLACE FUNCTION directory.sss_digits(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION directory.sss_usable(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    length(directory.sss_digits(p)) >= 8
    AND directory.sss_digits(p) <> repeat('0', length(directory.sss_digits(p)))
    AND directory.sss_digits(p) <> repeat(
      substr(directory.sss_digits(p), 1, 1),
      length(directory.sss_digits(p))
    );
$$;

CREATE INDEX IF NOT EXISTS employees_org_sss_digits_idx
  ON directory.employees (organization_id, (directory.sss_digits(sss_number)))
  WHERE sss_number IS NOT NULL;

CREATE OR REPLACE FUNCTION directory.find_employees_by_sss(
  p_org uuid,
  p_sss text
)
RETURNS TABLE (
  id uuid,
  employee_code text,
  last_name text,
  first_name text,
  status text,
  sss_number text,
  is_current_engagement boolean,
  client_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = directory
AS $$
  SELECT
    e.id,
    e.employee_code,
    e.last_name,
    e.first_name,
    e.status,
    e.sss_number,
    e.is_current_engagement,
    e.client_id
  FROM directory.employees e
  WHERE e.organization_id = p_org
    AND directory.sss_usable(p_sss)
    AND directory.sss_digits(e.sss_number) = directory.sss_digits(p_sss)
  ORDER BY e.is_current_engagement DESC, e.hire_date DESC NULLS LAST
  LIMIT 20;
$$;

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

DROP FUNCTION IF EXISTS directory.client_lifecycle_counts(uuid);

CREATE OR REPLACE FUNCTION directory.client_lifecycle_counts(p_org uuid)
RETURNS TABLE(
  client_id uuid,
  active_count bigint,
  for_release_count bigint,
  inactive_count bigint,
  needs_review_count bigint,
  duplicate_review_count bigint,
  employee_count bigint,
  latest_payroll_end date
)
LANGUAGE sql
STABLE
SET search_path = directory
AS $$
  WITH base AS (
    SELECT
      e.client_id,
      e.status,
      e.last_payroll_end,
      e.id,
      MAX(e.last_payroll_end) FILTER (
        WHERE e.last_payroll_end IS NOT NULL
          AND e.last_payroll_end >= DATE '2000-01-01'
      ) OVER (PARTITION BY e.client_id) AS client_latest
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
  ),
  dups AS (
    SELECT employee_id FROM directory.duplicate_review_ids(p_org, NULL::uuid)
  )
  SELECT
    b.client_id,
    count(*) FILTER (WHERE b.status = 'active')::bigint AS active_count,
    count(*) FILTER (WHERE b.status = 'for_release')::bigint AS for_release_count,
    count(*) FILTER (WHERE b.status = 'inactive')::bigint AS inactive_count,
    count(*) FILTER (
      WHERE b.status = 'active'
        AND (
          b.last_payroll_end IS NULL
          OR b.last_payroll_end < b.client_latest
          OR (
            b.client_latest IS NULL
            AND b.last_payroll_end IS NOT NULL
            AND b.last_payroll_end < (CURRENT_DATE - 35)
          )
          OR (
            b.client_latest IS NULL
            AND b.last_payroll_end IS NULL
          )
        )
    )::bigint AS needs_review_count,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM dups d WHERE d.employee_id = b.id
    ))::bigint AS duplicate_review_count,
    count(*)::bigint AS employee_count,
    max(b.client_latest) AS latest_payroll_end
  FROM base b
  GROUP BY b.client_id;
$$;

GRANT EXECUTE ON FUNCTION directory.sss_digits(text) TO service_role;
GRANT EXECUTE ON FUNCTION directory.sss_usable(text) TO service_role;
GRANT EXECUTE ON FUNCTION directory.find_employees_by_sss(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION directory.duplicate_review_ids(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION directory.client_lifecycle_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
