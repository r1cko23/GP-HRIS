CREATE TABLE directory.hire_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES directory.client_branches (id) ON DELETE CASCADE,
  csm_client_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'cleared')),
  created_by_name TEXT,
  cleared_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ
);

CREATE INDEX hire_alerts_open_branch_idx
  ON directory.hire_alerts (branch_id, status, created_at DESC);

ALTER TABLE directory.hire_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY hire_alerts_select
  ON directory.hire_alerts
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

COMMENT ON TABLE directory.hire_alerts IS
  'Name an Account Supervisor could not find on a site. HR inputs the 201. Clears when that person is picked onto Draft, or when HR dismisses it.';
