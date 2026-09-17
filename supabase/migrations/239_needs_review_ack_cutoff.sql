-- HR "Still working" ack: suppress needs_review until the client's next released cutoff.

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS needs_review_ack_cutoff DATE;

COMMENT ON COLUMN directory.employees.needs_review_ack_cutoff IS
  'Client latest payroll_end (or confirm date) when HR confirmed still working. Suppresses needs_review while ack >= client latest.';

CREATE INDEX IF NOT EXISTS employees_needs_review_ack_cutoff_idx
  ON directory.employees (organization_id, needs_review_ack_cutoff)
  WHERE is_current_engagement = true
    AND status = 'active'
    AND needs_review_ack_cutoff IS NOT NULL;

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
      e.needs_review_ack_cutoff,
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
        AND (
          b.needs_review_ack_cutoff IS NULL
          OR (
            b.client_latest IS NOT NULL
            AND b.needs_review_ack_cutoff < b.client_latest
          )
          OR (
            b.client_latest IS NULL
            AND b.needs_review_ack_cutoff < (CURRENT_DATE - 35)
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

CREATE OR REPLACE FUNCTION directory.employee_work_counts(p_org uuid)
RETURNS TABLE (
  needs_review bigint,
  missing_statutory bigint,
  missing_documents bigint,
  incomplete_201 bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH latest AS (
    SELECT
      e.client_id,
      MAX(e.last_payroll_end) FILTER (
        WHERE e.last_payroll_end IS NOT NULL AND e.last_payroll_end >= '2000-01-01'
      ) AS latest_payroll_end
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
    GROUP BY e.client_id
  ),
  current_people AS (
    SELECT e.*
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
  )
  SELECT
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      LEFT JOIN latest l ON l.client_id = e.client_id
      WHERE e.status = 'active'
        AND (
          e.last_payroll_end IS NULL
          OR (l.latest_payroll_end IS NOT NULL AND e.last_payroll_end < l.latest_payroll_end)
        )
        AND (
          e.needs_review_ack_cutoff IS NULL
          OR (
            l.latest_payroll_end IS NOT NULL
            AND e.needs_review_ack_cutoff < l.latest_payroll_end
          )
          OR (
            l.latest_payroll_end IS NULL
            AND e.needs_review_ack_cutoff < (CURRENT_DATE - 35)
          )
        )
    ) AS needs_review,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE COALESCE(NULLIF(BTRIM(e.tin), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sss_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.philhealth_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.pagibig_number), ''), NULL) IS NULL
    ) AS missing_statutory,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE e.has_statutory_scan = false
    ) AS missing_documents,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE e.birth_date IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sex), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.mobile), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.tin), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sss_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.philhealth_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.pagibig_number), ''), NULL) IS NULL
         OR e.position_id IS NULL
         OR e.daily_rate IS NULL
         OR (
           COALESCE(NULLIF(BTRIM(e.bank_account_no), ''), NULL) IS NULL
           AND COALESCE(NULLIF(BTRIM(e.gcash), ''), NULL) IS NULL
         )
    ) AS incomplete_201;
$$;

GRANT EXECUTE ON FUNCTION directory.client_lifecycle_counts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION directory.employee_work_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
