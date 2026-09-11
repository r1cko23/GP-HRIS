-- Sequential employment Tenures on one Directory person (ADR 0016).
-- Live 201 stays the current Tenure projection. Closed Tenures do not mutate.
-- Does not convert GREENHRISMAIN superseded 201 rows.

CREATE TABLE IF NOT EXISTS directory.employment_tenures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  hire_date DATE,
  resign_date DATE,
  client_id UUID REFERENCES directory.clients (id) ON DELETE SET NULL,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE SET NULL,
  position_id UUID REFERENCES directory.positions (id) ON DELETE SET NULL,
  daily_rate NUMERIC(12, 4),
  billing_daily_rate NUMERIC(12, 4),
  status TEXT NOT NULL,
  final_pay_status TEXT NOT NULL DEFAULT 'none'
    CHECK (final_pay_status IN ('none', 'in_progress', 'claimed', 'barred')),
  barred_reason TEXT
    CHECK (
      barred_reason IS NULL
      OR barred_reason IN ('unclaimed_final_pay', 'deployment_block')
    ),
  is_current BOOLEAN NOT NULL DEFAULT true,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employment_tenures_employee_sequence_key UNIQUE (employee_id, sequence)
);

COMMENT ON TABLE directory.employment_tenures IS
  'One employment episode per Directory person. Closed rows are immutable; Rehire opens a new current Tenure.';

COMMENT ON COLUMN directory.employment_tenures.sequence IS
  '1-based episode number on this person. Rehire increments; never reused.';

COMMENT ON COLUMN directory.employment_tenures.final_pay_status IS
  'Frozen final-pay outcome of this Tenure: none / in_progress / claimed / barred.';

COMMENT ON COLUMN directory.employment_tenures.barred_reason IS
  'unclaimed_final_pay = aged exit (Rehire). deployment_block = hold on current Tenure (Activate).';

CREATE UNIQUE INDEX IF NOT EXISTS employment_tenures_one_current_idx
  ON directory.employment_tenures (employee_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS employment_tenures_employee_idx
  ON directory.employment_tenures (organization_id, employee_id, sequence DESC);

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS current_tenure_id UUID
    REFERENCES directory.employment_tenures (id) ON DELETE SET NULL;

COMMENT ON COLUMN directory.employees.current_tenure_id IS
  'Live Tenure for this person. Hire date / rates / status on the 201 are this Tenure''s projection.';

INSERT INTO directory.employment_tenures (
  organization_id,
  employee_id,
  sequence,
  hire_date,
  resign_date,
  client_id,
  branch_id,
  position_id,
  daily_rate,
  billing_daily_rate,
  status,
  final_pay_status,
  barred_reason,
  is_current,
  closed_at
)
SELECT
  e.organization_id,
  e.id,
  1,
  e.hire_date,
  e.resign_date,
  e.client_id,
  e.branch_id,
  e.position_id,
  e.daily_rate,
  e.billing_daily_rate,
  e.status,
  CASE
    WHEN e.status = 'barred'
      AND e.last_payroll_end IS NOT NULL
      AND e.last_payroll_end <= (CURRENT_DATE - 1095)
      THEN 'barred'
    WHEN e.status = 'for_release' THEN 'in_progress'
    WHEN e.status = 'inactive' THEN 'claimed'
    ELSE 'none'
  END,
  CASE
    WHEN e.status = 'barred'
      AND e.last_payroll_end IS NOT NULL
      AND e.last_payroll_end <= (CURRENT_DATE - 1095)
      THEN 'unclaimed_final_pay'
    WHEN e.status = 'barred' THEN 'deployment_block'
    ELSE NULL
  END,
  true,
  NULL
FROM directory.employees e
WHERE e.is_current_engagement = true
  AND NOT EXISTS (
    SELECT 1
    FROM directory.employment_tenures t
    WHERE t.employee_id = e.id
  );

UPDATE directory.employees e
SET current_tenure_id = t.id
FROM directory.employment_tenures t
WHERE t.employee_id = e.id
  AND t.is_current
  AND e.current_tenure_id IS DISTINCT FROM t.id;

ALTER TABLE directory.employment_tenures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employment_tenures_all ON directory.employment_tenures;
CREATE POLICY employment_tenures_all ON directory.employment_tenures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON directory.employment_tenures TO service_role;

NOTIFY pgrst, 'reload schema';
