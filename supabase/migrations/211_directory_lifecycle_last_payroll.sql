-- Lifecycle SoT: last released payroll cutoff date per Directory person.

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS last_payroll_end DATE,
  ADD COLUMN IF NOT EXISTS last_payroll_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN directory.employees.last_payroll_end IS
  'Latest GREENHRISMAIN payroll_summary.Date_End for this person (legacy_id). Used for stale / needs-review.';
COMMENT ON COLUMN directory.employees.last_payroll_synced_at IS
  'When last_payroll_end was last refreshed from payroll_summary.';

CREATE INDEX IF NOT EXISTS employees_last_payroll_end_idx
  ON directory.employees (organization_id, last_payroll_end)
  WHERE is_current_engagement = true;

-- Per-client lifecycle headcounts for the Directory client picker.
CREATE OR REPLACE FUNCTION directory.client_lifecycle_counts(p_org uuid)
RETURNS TABLE(
  client_id uuid,
  active_count bigint,
  for_release_count bigint,
  inactive_count bigint,
  needs_review_count bigint,
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
      MAX(e.last_payroll_end) FILTER (
        WHERE e.last_payroll_end IS NOT NULL
          AND e.last_payroll_end >= DATE '2000-01-01'
      ) OVER (PARTITION BY e.client_id) AS client_latest
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
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
    count(*)::bigint AS employee_count,
    max(b.client_latest) AS latest_payroll_end
  FROM base b
  GROUP BY b.client_id;
$$;

GRANT EXECUTE ON FUNCTION directory.client_lifecycle_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
