-- Person-as-master transform support (ADR 0006).
-- Migrated GREENHRISMAIN rows stay; rehire chains map onto one live master.

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS first_hire_date DATE,
  ADD COLUMN IF NOT EXISTS employee_code_source TEXT
    CHECK (employee_code_source IS NULL OR employee_code_source IN ('legacy', 'directory'));

COMMENT ON COLUMN directory.employees.first_hire_date IS
  'Original first hire for this person. New Directory codes use this date; hire_date is the latest engagement start.';
COMMENT ON COLUMN directory.employees.employee_code_source IS
  'legacy = GREENHRISMAIN / kept code; directory = YYYYMMDD-##### issued by Directory.';

-- Prior engagement codes / legacy IDs that resolve to the master person.
CREATE TABLE IF NOT EXISTS directory.employee_code_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  alias_code TEXT,
  legacy_id INTEGER,
  source_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_code_aliases_has_key CHECK (
    alias_code IS NOT NULL OR legacy_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_code_aliases_org_code_key
  ON directory.employee_code_aliases (organization_id, alias_code)
  WHERE alias_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_code_aliases_org_legacy_key
  ON directory.employee_code_aliases (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_code_aliases_employee_idx
  ON directory.employee_code_aliases (employee_id);

ALTER TABLE directory.employee_code_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_code_aliases_all ON directory.employee_code_aliases;
CREATE POLICY employee_code_aliases_all ON directory.employee_code_aliases
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON directory.employee_code_aliases TO service_role;

-- Allocate YYYYMMDD-##### for a hire date within an organization.
-- Checks live codes and aliases so prior engagement codes are never reused.
CREATE OR REPLACE FUNCTION directory.allocate_employee_code(
  p_org uuid,
  p_hire_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory
AS $$
DECLARE
  v_prefix text := to_char(COALESCE(p_hire_date, CURRENT_DATE), 'YYYYMMDD');
  v_next int;
  v_code text;
BEGIN
  SELECT COALESCE(MAX(seq), 0) + 1
  INTO v_next
  FROM (
    SELECT CAST(substring(employee_code FROM 10) AS int) AS seq
    FROM directory.employees
    WHERE organization_id = p_org
      AND employee_code ~ ('^' || v_prefix || '-[0-9]{5}$')
    UNION ALL
    SELECT CAST(substring(alias_code FROM 10) AS int) AS seq
    FROM directory.employee_code_aliases
    WHERE organization_id = p_org
      AND alias_code ~ ('^' || v_prefix || '-[0-9]{5}$')
  ) s;

  v_code := v_prefix || '-' || lpad(v_next::text, 5, '0');
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION directory.allocate_employee_code(uuid, date) TO service_role;

COMMENT ON FUNCTION directory.allocate_employee_code(uuid, date) IS
  'Issues immutable Directory employee_code: YYYYMMDD-##### from first hire date.';

NOTIFY pgrst, 'reload schema';
