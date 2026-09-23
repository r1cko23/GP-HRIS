-- Possible duplicate queue: current engagements that share SSS / TIN /
-- PhilHealth / Pag-IBIG / bank, or name+DOB, or a split person_key.
-- Parked extras stay on file but must not keep the live 201 in the review list.
-- Bank shares are always review (family / shared accounts).

CREATE OR REPLACE FUNCTION directory.id_digits(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION directory.id_usable(p text, min_len int)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    length(directory.id_digits(p)) >= min_len
    AND directory.id_digits(p) <> repeat('0', length(directory.id_digits(p)))
    AND directory.id_digits(p) <> repeat(
      substr(directory.id_digits(p), 1, 1),
      length(directory.id_digits(p))
    );
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
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.sss_digits(e.sss_number)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND (p_client IS NULL OR e.client_id = p_client)
  ),
  tin_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT directory.id_digits(tin) AS digits
      FROM directory.employees
      WHERE organization_id = p_org
        AND directory.id_usable(tin, 9)
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.id_digits(e.tin)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND directory.id_usable(e.tin, 9)
      AND (p_client IS NULL OR e.client_id = p_client)
  ),
  philhealth_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT directory.id_digits(philhealth_number) AS digits
      FROM directory.employees
      WHERE organization_id = p_org
        AND directory.id_usable(philhealth_number, 10)
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.id_digits(e.philhealth_number)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND directory.id_usable(e.philhealth_number, 10)
      AND (p_client IS NULL OR e.client_id = p_client)
  ),
  pagibig_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT directory.id_digits(pagibig_number) AS digits
      FROM directory.employees
      WHERE organization_id = p_org
        AND directory.id_usable(pagibig_number, 8)
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.id_digits(e.pagibig_number)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND directory.id_usable(e.pagibig_number, 8)
      AND (p_client IS NULL OR e.client_id = p_client)
  ),
  bank_dups AS (
    SELECT e.id
    FROM directory.employees e
    JOIN (
      SELECT directory.id_digits(bank_account_no) AS digits
      FROM directory.employees
      WHERE organization_id = p_org
        AND directory.id_usable(bank_account_no, 8)
        AND is_current_engagement
      GROUP BY 1
      HAVING count(DISTINCT COALESCE(person_key, id::text)) > 1
    ) d ON d.digits = directory.id_digits(e.bank_account_no)
    WHERE e.organization_id = p_org
      AND e.is_current_engagement
      AND directory.id_usable(e.bank_account_no, 8)
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
  SELECT DISTINCT id FROM tin_dups
  UNION
  SELECT DISTINCT id FROM philhealth_dups
  UNION
  SELECT DISTINCT id FROM pagibig_dups
  UNION
  SELECT DISTINCT id FROM bank_dups
  UNION
  SELECT DISTINCT id FROM name_dups;
$$;

GRANT EXECUTE ON FUNCTION directory.id_digits(text) TO service_role;
GRANT EXECUTE ON FUNCTION directory.id_usable(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION directory.duplicate_review_ids(uuid, uuid) TO service_role;
