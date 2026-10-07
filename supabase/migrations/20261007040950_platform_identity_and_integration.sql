-- Workforce Platform foundation:
-- Person -> Employment -> Tenure -> Placement plus reliable integration delivery.
-- Existing directory.employees UUIDs remain the canonical person identifiers.

CREATE TABLE IF NOT EXISTS directory.employments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  worker_type TEXT NOT NULL DEFAULT 'employee'
    CHECK (worker_type IN ('employee', 'contractor', 'contingent')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'inactive', 'ended')),
  original_hire_date DATE,
  ended_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id)
);

COMMENT ON TABLE directory.employments IS
  'Stable relationship between a Directory person and Green Pasture as legal employer. Tenures are sequential episodes beneath this relationship.';

ALTER TABLE directory.employment_tenures
  ADD COLUMN IF NOT EXISTS employment_id UUID
    REFERENCES directory.employments (id) ON DELETE CASCADE;

INSERT INTO directory.employments (
  organization_id,
  employee_id,
  worker_type,
  status,
  original_hire_date,
  ended_at
)
SELECT
  e.organization_id,
  e.id,
  'employee',
  CASE WHEN e.status IN ('inactive', 'barred') THEN 'inactive' ELSE 'active' END,
  COALESCE(e.first_hire_date, e.hire_date),
  CASE WHEN e.status = 'inactive' THEN e.resign_date ELSE NULL END
FROM directory.employees e
ON CONFLICT (organization_id, employee_id) DO NOTHING;

UPDATE directory.employment_tenures t
SET employment_id = em.id
FROM directory.employments em
WHERE em.employee_id = t.employee_id
  AND em.organization_id = t.organization_id
  AND t.employment_id IS NULL;

ALTER TABLE directory.employment_tenures
  ALTER COLUMN employment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS employment_tenures_employment_idx
  ON directory.employment_tenures (employment_id, sequence DESC);

CREATE TABLE IF NOT EXISTS directory.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  candidate_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (
      status IN (
        'prospect',
        'applicant',
        'screening',
        'submitted',
        'selected',
        'placed',
        'withdrawn',
        'rejected',
        'archived'
      )
    ),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  email TEXT,
  mobile TEXT,
  source TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending', 'granted', 'withdrawn', 'expired')),
  consent_recorded_at TIMESTAMPTZ,
  available_from DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, candidate_number)
);

COMMENT ON TABLE directory.candidates IS
  'Recruiting profile linked to the durable person only when identity is established. Candidate state is not employment state.';

CREATE INDEX IF NOT EXISTS candidates_org_status_idx
  ON directory.candidates (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS candidates_employee_idx
  ON directory.candidates (employee_id)
  WHERE employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS directory.placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  employment_id UUID NOT NULL REFERENCES directory.employments (id) ON DELETE CASCADE,
  tenure_id UUID REFERENCES directory.employment_tenures (id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE RESTRICT,
  position_id UUID REFERENCES directory.positions (id) ON DELETE RESTRICT,
  external_job_order_id UUID,
  source_record_id TEXT,
  source_app TEXT NOT NULL DEFAULT 'gp-hris'
    CHECK (source_app IN ('gp-hris', 'csm-gp', 'migration')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'onboarding',
        'ready',
        'active',
        'paused',
        'completed',
        'cancelled'
      )
    ),
  starts_on DATE NOT NULL,
  ends_on DATE,
  payroll_daily_rate NUMERIC(12, 4),
  billing_daily_rate NUMERIC(12, 4),
  compliance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'ready', 'blocked', 'expired')),
  is_primary BOOLEAN NOT NULL DEFAULT true,
  ended_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

COMMENT ON TABLE directory.placements IS
  'Effective-dated worker assignment to a client site/job. Separate from person identity and agency employment.';
COMMENT ON COLUMN directory.placements.external_job_order_id IS
  'CSM-owned Job Order UUID. Deliberately no cross-database foreign key.';

CREATE INDEX IF NOT EXISTS placements_person_timeline_idx
  ON directory.placements (organization_id, employee_id, starts_on DESC);
CREATE INDEX IF NOT EXISTS placements_site_status_idx
  ON directory.placements (organization_id, client_id, branch_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS placements_one_primary_active_idx
  ON directory.placements (organization_id, employee_id)
  WHERE is_primary AND status IN ('ready', 'active', 'paused');
CREATE UNIQUE INDEX IF NOT EXISTS placements_source_record_idx
  ON directory.placements (organization_id, source_app, source_record_id)
  WHERE source_record_id IS NOT NULL;

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS current_placement_id UUID
    REFERENCES directory.placements (id) ON DELETE SET NULL;

COMMENT ON COLUMN directory.employees.current_placement_id IS
  'Primary live Placement projection. Concurrent assignments remain in directory.placements.';

-- Existing current 201 assignment becomes the initial primary placement.
INSERT INTO directory.placements (
  organization_id,
  employee_id,
  employment_id,
  tenure_id,
  client_id,
  branch_id,
  position_id,
  source_app,
  status,
  starts_on,
  ends_on,
  payroll_daily_rate,
  billing_daily_rate,
  compliance_status,
  is_primary
)
SELECT
  e.organization_id,
  e.id,
  em.id,
  e.current_tenure_id,
  e.client_id,
  e.branch_id,
  e.position_id,
  'migration',
  CASE
    WHEN e.status = 'active' THEN 'active'
    WHEN e.status = 'for_verification' THEN 'onboarding'
    WHEN e.status IN ('float', 'barred') THEN 'paused'
    ELSE 'completed'
  END,
  COALESCE(e.hire_date, e.first_hire_date, e.created_at::date),
  CASE WHEN e.status IN ('inactive', 'for_release') THEN e.resign_date ELSE NULL END,
  e.daily_rate,
  e.billing_daily_rate,
  CASE WHEN e.status = 'active' THEN 'ready' ELSE 'pending' END,
  true
FROM directory.employees e
JOIN directory.employments em
  ON em.organization_id = e.organization_id
 AND em.employee_id = e.id
WHERE e.client_id IS NOT NULL
  AND e.is_current_engagement = true
  AND NOT EXISTS (
    SELECT 1
    FROM directory.placements p
    WHERE p.organization_id = e.organization_id
      AND p.employee_id = e.id
      AND p.is_primary
      AND p.status IN ('ready', 'active', 'paused')
  );

UPDATE directory.employees e
SET current_placement_id = p.id
FROM directory.placements p
WHERE p.organization_id = e.organization_id
  AND p.employee_id = e.id
  AND p.is_primary
  AND p.status IN ('ready', 'active', 'paused')
  AND e.current_placement_id IS DISTINCT FROM p.id;

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  producer TEXT NOT NULL,
  subject TEXT NOT NULL,
  organization_id UUID NOT NULL,
  client_id UUID,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  causation_id UUID,
  actor JSONB NOT NULL,
  trace_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  destination_app TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 12 CHECK (max_attempts > 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  consumer_name TEXT NOT NULL,
  producer TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL CHECK (event_version > 0),
  subject TEXT NOT NULL,
  organization_id UUID NOT NULL,
  client_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NOT NULL,
  causation_id UUID,
  envelope JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  UNIQUE (consumer_name, event_id)
);

CREATE TABLE IF NOT EXISTS public.integration_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciler TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  scanned_count INTEGER NOT NULL DEFAULT 0 CHECK (scanned_count >= 0),
  missing_count INTEGER NOT NULL DEFAULT 0 CHECK (missing_count >= 0),
  repaired_count INTEGER NOT NULL DEFAULT 0 CHECK (repaired_count >= 0),
  unresolved_count INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_count >= 0),
  stale_count INTEGER NOT NULL DEFAULT 0 CHECK (stale_count >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS integration_outbox_dispatch_idx
  ON public.integration_outbox (destination_app, status, available_at, occurred_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS integration_outbox_aggregate_idx
  ON public.integration_outbox (subject, occurred_at);
CREATE INDEX IF NOT EXISTS integration_inbox_process_idx
  ON public.integration_inbox (status, received_at)
  WHERE status IN ('received', 'failed');

ALTER TABLE directory.employments ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employments_service_all ON directory.employments;
CREATE POLICY employments_service_all ON directory.employments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS candidates_service_all ON directory.candidates;
CREATE POLICY candidates_service_all ON directory.candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS placements_service_all ON directory.placements;
CREATE POLICY placements_service_all ON directory.placements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS integration_outbox_service_all ON public.integration_outbox;
CREATE POLICY integration_outbox_service_all ON public.integration_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS integration_inbox_service_all ON public.integration_inbox;
CREATE POLICY integration_inbox_service_all ON public.integration_inbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS integration_reconciliation_service_all
  ON public.integration_reconciliation_runs;
CREATE POLICY integration_reconciliation_service_all
  ON public.integration_reconciliation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  directory.employments,
  directory.candidates,
  directory.placements
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.integration_outbox,
  public.integration_inbox,
  public.integration_reconciliation_runs
TO service_role;

CREATE OR REPLACE FUNCTION directory.accept_csm_placement_event(
  p_envelope JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory, public
AS $$
DECLARE
  v_event_id UUID := (p_envelope->>'event_id')::UUID;
  v_organization_id UUID := (p_envelope->>'organization_id')::UUID;
  v_client_id UUID := (p_envelope->>'client_id')::UUID;
  v_data JSONB := p_envelope->'data';
  v_source_record_id TEXT := v_data->>'placement_id';
  v_employee_id UUID := (v_data->>'person_id')::UUID;
  v_employment_id UUID := (v_data->>'employment_id')::UUID;
  v_tenure_id UUID;
  v_placement_id UUID;
  v_inserted_inbox UUID;
BEGIN
  IF p_envelope->>'event_type' <> 'gp.csm.placement.approved.v1' THEN
    RAISE EXCEPTION 'Unsupported placement event type';
  END IF;

  INSERT INTO public.integration_inbox (
    event_id,
    consumer_name,
    producer,
    event_type,
    event_version,
    subject,
    organization_id,
    client_id,
    data,
    correlation_id,
    causation_id,
    envelope,
    status
  )
  VALUES (
    v_event_id,
    'gp-hris-placement',
    p_envelope->>'producer',
    p_envelope->>'event_type',
    (p_envelope->>'event_version')::INTEGER,
    p_envelope->>'subject',
    v_organization_id,
    v_client_id,
    v_data,
    (p_envelope->>'correlation_id')::UUID,
    NULLIF(p_envelope->>'causation_id', '')::UUID,
    p_envelope,
    'processing'
  )
  ON CONFLICT (consumer_name, event_id) DO NOTHING
  RETURNING id INTO v_inserted_inbox;

  IF v_inserted_inbox IS NULL THEN
    SELECT id INTO v_placement_id
    FROM directory.placements
    WHERE organization_id = v_organization_id
      AND source_app = 'csm-gp'
      AND source_record_id = v_source_record_id;
    RETURN v_placement_id;
  END IF;

  PERFORM 1
  FROM directory.employments
  WHERE id = v_employment_id
    AND organization_id = v_organization_id
    AND employee_id = v_employee_id
    AND status IN ('pending', 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employment does not match the placement person and organization';
  END IF;

  SELECT id INTO v_tenure_id
  FROM directory.employment_tenures
  WHERE employment_id = v_employment_id
    AND is_current
  ORDER BY sequence DESC
  LIMIT 1;
  IF v_tenure_id IS NULL THEN
    RAISE EXCEPTION 'Placement person has no current tenure';
  END IF;

  INSERT INTO directory.placements (
    organization_id,
    employee_id,
    employment_id,
    tenure_id,
    client_id,
    branch_id,
    position_id,
    external_job_order_id,
    source_record_id,
    source_app,
    status,
    starts_on,
    ends_on,
    compliance_status
  )
  VALUES (
    v_organization_id,
    v_employee_id,
    v_employment_id,
    v_tenure_id,
    v_client_id,
    (v_data->>'branch_id')::UUID,
    (v_data->>'position_id')::UUID,
    (v_data->>'demand_id')::UUID,
    v_source_record_id,
    'csm-gp',
    'onboarding',
    (v_data->>'effective_from')::DATE,
    NULLIF(v_data->>'effective_to', '')::DATE,
    'pending'
  )
  RETURNING id INTO v_placement_id;

  UPDATE public.integration_inbox
  SET status = 'processed', processed_at = now()
  WHERE id = v_inserted_inbox;

  RETURN v_placement_id;
END;
$$;

REVOKE ALL ON FUNCTION directory.accept_csm_placement_event(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory.accept_csm_placement_event(JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION directory.convert_candidate_to_person(
  p_candidate_id UUID,
  p_hire_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory, public
AS $$
DECLARE
  v_candidate directory.candidates;
  v_employee_id UUID;
  v_employment_id UUID;
  v_tenure_id UUID;
BEGIN
  SELECT * INTO v_candidate
  FROM directory.candidates
  WHERE id = p_candidate_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_candidate.employee_id IS NOT NULL THEN
    RETURN v_candidate.employee_id;
  END IF;
  IF v_candidate.status <> 'selected'
    OR v_candidate.consent_status <> 'granted'
  THEN
    RAISE EXCEPTION 'Candidate must be selected with granted consent';
  END IF;

  INSERT INTO directory.employees (
    organization_id,
    first_name,
    middle_name,
    last_name,
    email,
    mobile,
    hire_date,
    status
  )
  VALUES (
    v_candidate.organization_id,
    v_candidate.first_name,
    v_candidate.middle_name,
    v_candidate.last_name,
    v_candidate.email,
    v_candidate.mobile,
    p_hire_date,
    'for_verification'
  )
  RETURNING id INTO v_employee_id;

  INSERT INTO directory.employments (
    organization_id,
    employee_id,
    status,
    original_hire_date
  )
  VALUES (
    v_candidate.organization_id,
    v_employee_id,
    'pending',
    p_hire_date
  )
  RETURNING id INTO v_employment_id;

  INSERT INTO directory.employment_tenures (
    organization_id,
    employee_id,
    employment_id,
    sequence,
    hire_date,
    status,
    is_current
  )
  VALUES (
    v_candidate.organization_id,
    v_employee_id,
    v_employment_id,
    1,
    p_hire_date,
    'for_verification',
    true
  )
  RETURNING id INTO v_tenure_id;

  UPDATE directory.employees
  SET current_tenure_id = v_tenure_id, updated_at = now()
  WHERE id = v_employee_id;
  UPDATE directory.candidates
  SET employee_id = v_employee_id, updated_at = now()
  WHERE id = p_candidate_id;

  RETURN v_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION directory.convert_candidate_to_person(UUID, DATE)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory.convert_candidate_to_person(UUID, DATE)
  TO service_role;

NOTIFY pgrst, 'reload schema';
