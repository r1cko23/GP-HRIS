-- People hub: include for_verification in org-wide work-queue counts.
DROP FUNCTION IF EXISTS directory.employee_work_counts(uuid);

CREATE FUNCTION directory.employee_work_counts(p_org uuid)
RETURNS TABLE (
  needs_review bigint,
  missing_statutory bigint,
  missing_documents bigint,
  incomplete_201 bigint,
  for_verification bigint
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
    ) AS incomplete_201,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE e.status = 'for_verification'
    ) AS for_verification;
$$;

GRANT EXECUTE ON FUNCTION directory.employee_work_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
