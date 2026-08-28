-- HR migration decisions: office Employees ↔ Directory Organic (no auto-merge)
CREATE TABLE IF NOT EXISTS directory.office_reconcile_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  office_employee_id UUID NOT NULL,
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('link', 'create', 'skip')),
  match_method TEXT,
  note TEXT,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, office_employee_id)
);

CREATE INDEX IF NOT EXISTS office_reconcile_decisions_org_idx
  ON directory.office_reconcile_decisions (organization_id);

ALTER TABLE directory.office_reconcile_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS office_reconcile_decisions_service ON directory.office_reconcile_decisions;
CREATE POLICY office_reconcile_decisions_service ON directory.office_reconcile_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON directory.office_reconcile_decisions TO service_role;
