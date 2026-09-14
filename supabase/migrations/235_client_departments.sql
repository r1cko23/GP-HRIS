-- GREENHRISMAIN dbo.Department (client Department and Groupings tab).
-- CSM outlets store directory_department_id. Payroll sites stay on client_branches.

CREATE TABLE directory.client_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prepared_by TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE directory.client_departments IS
  'GREENHRISMAIN dbo.Department store/location. CSM outlet binds directory_department_id here.';

CREATE UNIQUE INDEX client_departments_org_legacy_id_key
  ON directory.client_departments (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX client_departments_client_id_idx
  ON directory.client_departments (client_id);

CREATE TRIGGER client_departments_set_updated_at
  BEFORE UPDATE ON directory.client_departments
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS department_id UUID
    REFERENCES directory.client_departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_department_id_idx
  ON directory.employees (department_id);

ALTER TABLE directory.client_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_departments_all ON directory.client_departments;
CREATE POLICY client_departments_all ON directory.client_departments
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON directory.client_departments TO service_role;

NOTIFY pgrst, 'reload schema';
