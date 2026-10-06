CREATE TABLE directory.employee_disciplinary_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  csm_case_id UUID NOT NULL,
  case_reference TEXT NOT NULL,
  incident_on DATE,
  incident_text TEXT,
  alleged_offense TEXT,
  rule_number TEXT,
  section_label TEXT,
  violation TEXT,
  case_status TEXT NOT NULL,
  ir_submitted_on DATE,
  nte_issued_on DATE,
  nte_returned_on DATE,
  nte_to_hr_on DATE,
  nod_to_supervisor_on DATE,
  nod_issued_on DATE,
  remarks TEXT,
  notes TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (csm_case_id)
);

CREATE INDEX employee_disciplinary_cases_employee_idx
  ON directory.employee_disciplinary_cases (employee_id, incident_on DESC);

ALTER TABLE directory.employee_disciplinary_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_disciplinary_cases_select
  ON directory.employee_disciplinary_cases
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr()
    OR organization_id IN (SELECT directory.organization_ids_for_user())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON directory.employee_disciplinary_cases TO service_role;
GRANT SELECT ON directory.employee_disciplinary_cases TO authenticated;
