-- Directory status scrub: legacy source columns + person dedup metadata.
-- Does not delete 201 files — marks superseded rehire engagements.

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS legacy_status TEXT,
  ADD COLUMN IF NOT EXISTS legacy_employee_status TEXT,
  ADD COLUMN IF NOT EXISTS legacy_final_pay_status TEXT,
  ADD COLUMN IF NOT EXISTS person_key TEXT,
  ADD COLUMN IF NOT EXISTS is_current_engagement BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES directory.employees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_person_key_idx
  ON directory.employees (organization_id, person_key)
  WHERE person_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS employees_current_engagement_idx
  ON directory.employees (organization_id, is_current_engagement)
  WHERE is_current_engagement = true;

COMMENT ON COLUMN directory.employees.legacy_status IS
  'Raw GREENHRISMAIN Employee.status at last sync/scrub.';
COMMENT ON COLUMN directory.employees.legacy_employee_status IS
  'Raw GREENHRISMAIN Employee.employee_status (employment type / on leave).';
COMMENT ON COLUMN directory.employees.legacy_final_pay_status IS
  'Raw GREENHRISMAIN Employee.finalpaystatus. For Release = exiting, final pay pending.';
COMMENT ON COLUMN directory.employees.person_key IS
  'Identity fingerprint for same-person rehire chains (SSS+TIN+DOB, etc.).';
COMMENT ON COLUMN directory.employees.is_current_engagement IS
  'False when a newer 201 file supersedes this row for the same person_key.';
COMMENT ON COLUMN directory.employees.superseded_by IS
  'Points to the preferred current engagement row for this person.';

-- Operational roster: one row per person (current engagement), all orgs.
CREATE OR REPLACE VIEW directory.roster_current AS
SELECT e.*
FROM directory.employees e
WHERE e.is_current_engagement = true;

COMMENT ON VIEW directory.roster_current IS
  'Current engagement per person_key — use for headcount; full history stays in directory.employees.';

-- Headcount by normalized status (current engagements only).
CREATE OR REPLACE FUNCTION directory.roster_status_totals(p_org uuid DEFAULT NULL)
RETURNS TABLE(status text, employee_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = directory, public
AS $$
  SELECT e.status::text, count(*)::bigint
  FROM directory.employees e
  WHERE e.is_current_engagement = true
    AND (p_org IS NULL OR e.organization_id = p_org)
  GROUP BY e.status
  ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION directory.roster_status_totals(uuid) TO service_role;
