-- Directory kernel on the existing GP-HRIS Supabase project.
-- Lives in schema directory so public.employees (clock / leave / OT) is untouched.

CREATE SCHEMA IF NOT EXISTS directory;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

CREATE TABLE directory.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organizations_legacy_id_key
  ON directory.organizations (legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE TABLE directory.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'csm', 'payroll', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_members_user_id_idx
  ON directory.organization_members (user_id)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Clients / branches / positions
-- ---------------------------------------------------------------------------

CREATE TABLE directory.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tin TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  cut1_start SMALLINT,
  cut1_end SMALLINT,
  cut2_start SMALLINT,
  cut2_end SMALLINT,
  pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'semi-monthly', 'monthly')),
  statutory_schedule TEXT,
  wtax_schedule TEXT,
  sss_basis TEXT,
  philhealth_basis TEXT,
  wtax_basis TEXT,
  include_cola BOOLEAN NOT NULL DEFAULT false,
  include_sea BOOLEAN NOT NULL DEFAULT false,
  include_ctpa BOOLEAN NOT NULL DEFAULT false,
  admin_fee NUMERIC(12, 4),
  vat NUMERIC(12, 4),
  ewt NUMERIC(12, 4),
  thirteenth_month_year INTEGER,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_org_legacy_id_key
  ON directory.clients (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX clients_organization_id_idx ON directory.clients (organization_id);
CREATE INDEX clients_name_idx ON directory.clients (organization_id, name);

CREATE TABLE directory.client_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX client_branches_org_legacy_id_key
  ON directory.client_branches (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX client_branches_client_id_idx ON directory.client_branches (client_id);

CREATE TABLE directory.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  department TEXT,
  group_name TEXT,
  payroll_daily_rate NUMERIC(12, 4),
  payroll_ot_rate NUMERIC(12, 4),
  payroll_nd_rate NUMERIC(12, 4),
  payroll_legal_holiday_rate NUMERIC(12, 4),
  payroll_special_holiday_rate NUMERIC(12, 4),
  payroll_rest_day_rate NUMERIC(12, 4),
  billing_daily_rate NUMERIC(12, 4),
  billing_ot_rate NUMERIC(12, 4),
  ecola NUMERIC(12, 4),
  sea NUMERIC(12, 4),
  ctpa NUMERIC(12, 4),
  allowance NUMERIC(12, 4),
  is_active BOOLEAN NOT NULL DEFAULT true,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX positions_org_legacy_id_key
  ON directory.positions (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX positions_client_id_idx ON directory.positions (client_id);
CREATE INDEX positions_branch_id_idx ON directory.positions (branch_id);

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------

CREATE TABLE directory.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID REFERENCES directory.clients (id) ON DELETE SET NULL,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL,
  position_id UUID REFERENCES directory.positions (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  sex TEXT,
  birth_date DATE,
  hire_date DATE,
  regular_date DATE,
  resign_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN (
      'active',
      'inactive',
      'barred',
      'float',
      'for_release',
      'for_verification'
    )
  ),
  daily_rate NUMERIC(12, 4),
  billing_daily_rate NUMERIC(12, 4),
  ecola NUMERIC(12, 4),
  tin TEXT,
  sss_number TEXT,
  philhealth_number TEXT,
  pagibig_number TEXT,
  tax_status TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  gcash TEXT,
  pay_through TEXT,
  email TEXT,
  mobile TEXT,
  address TEXT,
  profile_picture_url TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX employees_org_legacy_id_key
  ON directory.employees (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employees_org_code_key
  ON directory.employees (organization_id, employee_code)
  WHERE employee_code IS NOT NULL;

CREATE INDEX employees_organization_status_idx
  ON directory.employees (organization_id, status);

CREATE INDEX employees_client_id_idx ON directory.employees (client_id);

CREATE INDEX employees_name_idx
  ON directory.employees (organization_id, last_name, first_name);

-- ---------------------------------------------------------------------------
-- 201 file children
-- ---------------------------------------------------------------------------

CREATE TABLE directory.employee_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  name TEXT,
  relationship TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  relationship TEXT,
  birth_date DATE,
  gender TEXT,
  occupation TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  school TEXT,
  degree TEXT,
  level TEXT,
  from_year TEXT,
  to_year TEXT,
  honors TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  company TEXT,
  position_held TEXT,
  from_year TEXT,
  to_year TEXT,
  reason_for_leaving TEXT,
  remarks TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  license_no TEXT,
  course TEXT,
  awarded_on TEXT,
  expires_on TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_medical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  medical_type TEXT,
  medical_status TEXT,
  medical_date TEXT,
  expires_on TEXT,
  remarks TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  date_from TEXT,
  date_to TEXT,
  status TEXT,
  department TEXT,
  position TEXT,
  remarks TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  skill TEXT,
  proficiency TEXT,
  years_experience TEXT,
  remarks TEXT,
  legacy_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE directory.barred_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  client_name TEXT,
  department_name TEXT,
  last_payroll DATE,
  status TEXT,
  legacy_employee_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX employee_contacts_org_legacy_id_key
  ON directory.employee_contacts (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_dependents_org_legacy_id_key
  ON directory.employee_dependents (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_education_org_legacy_id_key
  ON directory.employee_education (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_job_history_org_legacy_id_key
  ON directory.employee_job_history (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_licenses_org_legacy_id_key
  ON directory.employee_licenses (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_medical_org_legacy_id_key
  ON directory.employee_medical (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_movements_org_legacy_id_key
  ON directory.employee_movements (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX employee_skills_org_legacy_id_key
  ON directory.employee_skills (organization_id, legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX barred_employees_org_legacy_idx
  ON directory.barred_employees (organization_id, legacy_employee_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION directory.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = directory, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON directory.organizations
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON directory.clients
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

CREATE TRIGGER client_branches_set_updated_at
  BEFORE UPDATE ON directory.client_branches
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

CREATE TRIGGER positions_set_updated_at
  BEFORE UPDATE ON directory.positions
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON directory.employees
  FOR EACH ROW EXECUTE FUNCTION directory.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (private schema — not Data API)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION directory.organization_ids_for_user()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = directory, public
AS $$
  SELECT organization_id
  FROM directory.organization_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

REVOKE ALL ON FUNCTION directory.organization_ids_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory.organization_ids_for_user() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE directory.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.client_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_medical ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.barred_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON directory.organizations
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr()
    OR id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY organizations_update ON directory.organizations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_hr()
    OR id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY organization_members_select ON directory.organization_members
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr()
    OR user_id = auth.uid()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY clients_all ON directory.clients
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY client_branches_all ON directory.client_branches
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY positions_all ON directory.positions
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employees_all ON directory.employees
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_contacts_all ON directory.employee_contacts
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_dependents_all ON directory.employee_dependents
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_education_all ON directory.employee_education
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_job_history_all ON directory.employee_job_history
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_licenses_all ON directory.employee_licenses
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_medical_all ON directory.employee_medical
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_movements_all ON directory.employee_movements
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY employee_skills_all ON directory.employee_skills
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

CREATE POLICY barred_employees_all ON directory.barred_employees
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  )
  WITH CHECK (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

GRANT USAGE ON SCHEMA directory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA directory TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA directory TO service_role;

-- Clock/leave employees stay in public.employees; these IDs link to Directory.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS directory_client_id UUID REFERENCES directory.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_directory_employee_id
  ON public.employees (directory_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_directory_client_id
  ON public.employees (directory_client_id);

COMMENT ON COLUMN public.employees.directory_employee_id IS
  'Optional link to directory.employees. Clock, leave, and OT stay on this row.';
COMMENT ON COLUMN public.employees.directory_client_id IS
  'Optional link to directory.clients for deployed staff.';


COMMENT ON TABLE directory.organizations IS 'Internal Green Pasture entity. Users belong via organization_members.';
COMMENT ON TABLE directory.clients IS 'Employer we deploy people to. GREENHRISMAIN dbo.client.';
COMMENT ON TABLE directory.employees IS 'Person of record. HRIS and Attendance store this id as directory_employee_id.';
