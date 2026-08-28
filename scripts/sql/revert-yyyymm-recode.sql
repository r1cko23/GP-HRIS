-- Temporary revert: live codes back to pre-YYYYMM-##### values.
-- Keeps YYYYMM codes as deferred aliases for a future cutover.
-- Does NOT touch public.employees.portal_password.
-- Local recode scripts / migration 212 remain valid to re-apply later.
--
-- Run via Supabase SQL editor / MCP execute_sql (service role).

BEGIN;

-- 1) Preserve current YYYYMM live codes as deferred aliases
INSERT INTO directory.employee_code_aliases (
  organization_id,
  employee_id,
  alias_code,
  note
)
SELECT
  e.organization_id,
  e.id,
  e.employee_code,
  'Deferred YYYYMM-##### after temporary revert — keep for future cutover'
FROM directory.employees e
JOIN directory.employee_code_aliases a
  ON a.employee_id = e.id
 AND a.organization_id = e.organization_id
 AND a.note = 'Former live code before YYYYMM-##### recode → ' || e.employee_code
WHERE e.employee_code ~ '^[0-9]{6}-[0-9]{5}$'
  AND NOT EXISTS (
    SELECT 1
    FROM directory.employee_code_aliases x
    WHERE x.organization_id = e.organization_id
      AND x.alias_code = e.employee_code
  );

-- 2) Restore Directory live employee_code to pre-recode value
UPDATE directory.employees e
SET
  employee_code = a.alias_code,
  employee_code_source = 'legacy',
  updated_at = now()
FROM directory.employee_code_aliases a
WHERE a.employee_id = e.id
  AND a.organization_id = e.organization_id
  AND a.note = 'Former live code before YYYYMM-##### recode → ' || e.employee_code
  AND e.employee_code ~ '^[0-9]{6}-[0-9]{5}$';

-- 3) Restore office clock login IDs (employee_id / employee_code only)
UPDATE public.employees e
SET
  employee_id = a.alias_code,
  employee_code = a.alias_code
FROM directory.employee_code_aliases a
WHERE a.employee_id = e.directory_employee_id
  AND a.note = 'Former live code before YYYYMM-##### recode → ' || e.employee_id
  AND e.employee_id ~ '^[0-9]{6}-[0-9]{5}$';

COMMIT;
