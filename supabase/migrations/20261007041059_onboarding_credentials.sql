-- Reusable onboarding packets and contextual placement credential readiness.
-- All access is service-role-only initially; application APIs enforce 201 grants.

CREATE TABLE directory.packet_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code, version)
);

CREATE TABLE directory.packet_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  packet_template_id UUID NOT NULL REFERENCES directory.packet_templates (id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  default_owner_type TEXT NOT NULL DEFAULT 'hr'
    CHECK (default_owner_type IN ('worker', 'hr', 'client')),
  due_days INTEGER CHECK (due_days IS NULL OR due_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (packet_template_id, task_key)
);

CREATE TABLE directory.employee_onboarding_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  placement_id UUID REFERENCES directory.placements (id) ON DELETE SET NULL,
  packet_template_id UUID NOT NULL REFERENCES directory.packet_templates (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR status <> 'completed'
  )
);

CREATE TABLE directory.employee_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  packet_id UUID NOT NULL REFERENCES directory.employee_onboarding_packets (id) ON DELETE CASCADE,
  template_task_id UUID REFERENCES directory.packet_template_tasks (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  owner_type TEXT NOT NULL DEFAULT 'hr'
    CHECK (owner_type IN ('worker', 'hr', 'client')),
  owner_id UUID,
  due_at TIMESTAMPTZ,
  evidence_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (
      evidence_status IN (
        'not_required',
        'requested',
        'uploaded',
        'accepted',
        'rejected'
      )
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'waived', 'rejected')),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status IN ('completed', 'waived') AND completed_at IS NOT NULL)
    OR status NOT IN ('completed', 'waived')
  ),
  UNIQUE (packet_id, template_task_id)
);

CREATE TABLE directory.credential_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_validity_days INTEGER CHECK (default_validity_days IS NULL OR default_validity_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE directory.credential_requirement_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  credential_definition_id UUID NOT NULL REFERENCES directory.credential_definitions (id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization', 'client', 'branch', 'position')),
  client_id UUID REFERENCES directory.clients (id) ON DELETE CASCADE,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE CASCADE,
  position_id UUID REFERENCES directory.positions (id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_blocking BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from),
  CHECK (
    (scope_type = 'organization' AND client_id IS NULL AND branch_id IS NULL AND position_id IS NULL)
    OR (scope_type = 'client' AND client_id IS NOT NULL AND branch_id IS NULL AND position_id IS NULL)
    OR (scope_type = 'branch' AND client_id IS NULL AND branch_id IS NOT NULL AND position_id IS NULL)
    OR (scope_type = 'position' AND client_id IS NULL AND branch_id IS NULL AND position_id IS NOT NULL)
  )
);

CREATE TABLE directory.employee_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  credential_definition_id UUID NOT NULL REFERENCES directory.credential_definitions (id) ON DELETE RESTRICT,
  credential_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'revoked')),
  issued_on DATE,
  expires_on DATE,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on),
  CHECK (
    (status = 'verified' AND verified_at IS NOT NULL)
    OR status <> 'verified'
  ),
  UNIQUE (employee_id, credential_definition_id)
);

CREATE TABLE directory.placement_credential_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  placement_id UUID NOT NULL REFERENCES directory.placements (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES directory.credential_requirement_policies (id) ON DELETE CASCADE,
  credential_definition_id UUID NOT NULL REFERENCES directory.credential_definitions (id) ON DELETE CASCADE,
  employee_credential_id UUID REFERENCES directory.employee_credentials (id) ON DELETE SET NULL,
  status TEXT NOT NULL
    CHECK (status IN ('optional', 'missing', 'pending', 'valid', 'expired', 'rejected', 'revoked')),
  is_blocking BOOLEAN NOT NULL DEFAULT false,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (placement_id, policy_id)
);

CREATE INDEX packet_templates_active_idx
  ON directory.packet_templates (organization_id, is_active, code);
CREATE INDEX employee_onboarding_packets_employee_idx
  ON directory.employee_onboarding_packets (organization_id, employee_id, status);
CREATE INDEX employee_onboarding_tasks_packet_idx
  ON directory.employee_onboarding_tasks (packet_id, sort_order, created_at);
CREATE INDEX credential_policies_context_idx
  ON directory.credential_requirement_policies (
    organization_id,
    scope_type,
    client_id,
    branch_id,
    position_id
  );
CREATE INDEX employee_credentials_employee_idx
  ON directory.employee_credentials (organization_id, employee_id, status);
CREATE INDEX placement_credential_evaluations_blockers_idx
  ON directory.placement_credential_evaluations (placement_id, is_blocking, status);

ALTER TABLE directory.packet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.packet_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_onboarding_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.credential_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.credential_requirement_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory.placement_credential_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY packet_templates_service_all ON directory.packet_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY packet_template_tasks_service_all ON directory.packet_template_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_onboarding_packets_service_all ON directory.employee_onboarding_packets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_onboarding_tasks_service_all ON directory.employee_onboarding_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY credential_definitions_service_all ON directory.credential_definitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY credential_requirement_policies_service_all ON directory.credential_requirement_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_credentials_service_all ON directory.employee_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY placement_credential_evaluations_service_all ON directory.placement_credential_evaluations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON
  directory.packet_templates,
  directory.packet_template_tasks,
  directory.employee_onboarding_packets,
  directory.employee_onboarding_tasks,
  directory.credential_definitions,
  directory.credential_requirement_policies,
  directory.employee_credentials,
  directory.placement_credential_evaluations
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  directory.packet_templates,
  directory.packet_template_tasks,
  directory.employee_onboarding_packets,
  directory.employee_onboarding_tasks,
  directory.credential_definitions,
  directory.credential_requirement_policies,
  directory.employee_credentials,
  directory.placement_credential_evaluations
TO service_role;

COMMENT ON TABLE directory.employee_onboarding_packets IS
  'Versioned onboarding packet assigned to one Directory employee and optionally one placement.';
COMMENT ON TABLE directory.credential_requirement_policies IS
  'Contextual credential rules scoped to an organization, client, branch, or position.';
COMMENT ON TABLE directory.placement_credential_evaluations IS
  'Last persisted credential readiness evaluation for a placement and policy.';

CREATE OR REPLACE FUNCTION directory.assign_onboarding_packet(
  p_employee_id UUID,
  p_packet_template_id UUID,
  p_placement_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory, public
AS $$
DECLARE
  v_organization_id UUID;
  v_packet_id UUID;
BEGIN
  SELECT organization_id INTO v_organization_id
  FROM directory.employees
  WHERE id = p_employee_id;
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM directory.packet_templates
  WHERE id = p_packet_template_id
    AND organization_id = v_organization_id
    AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active packet template not found';
  END IF;

  INSERT INTO directory.employee_onboarding_packets (
    organization_id,
    employee_id,
    placement_id,
    packet_template_id
  )
  VALUES (
    v_organization_id,
    p_employee_id,
    p_placement_id,
    p_packet_template_id
  )
  RETURNING id INTO v_packet_id;

  INSERT INTO directory.employee_onboarding_tasks (
    organization_id,
    employee_id,
    packet_id,
    template_task_id,
    title,
    description,
    sort_order,
    is_required,
    owner_type,
    due_at
  )
  SELECT
    v_organization_id,
    p_employee_id,
    v_packet_id,
    task.id,
    task.title,
    task.description,
    task.sort_order,
    task.is_required,
    task.default_owner_type,
    CASE
      WHEN task.due_days IS NULL THEN NULL
      ELSE now() + make_interval(days => task.due_days)
    END
  FROM directory.packet_template_tasks task
  WHERE task.packet_template_id = p_packet_template_id
  ORDER BY task.sort_order, task.created_at;

  RETURN v_packet_id;
END;
$$;

REVOKE ALL ON FUNCTION directory.assign_onboarding_packet(UUID, UUID, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory.assign_onboarding_packet(UUID, UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION directory.create_packet_template(
  p_organization_id UUID,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_tasks JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = directory, public
AS $$
DECLARE
  v_template_id UUID;
BEGIN
  IF jsonb_typeof(p_tasks) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_tasks) = 0
  THEN
    RAISE EXCEPTION 'Packet template requires at least one task';
  END IF;

  INSERT INTO directory.packet_templates (
    organization_id,
    code,
    name,
    description
  )
  VALUES (
    p_organization_id,
    upper(btrim(p_code)),
    btrim(p_name),
    NULLIF(btrim(p_description), '')
  )
  RETURNING id INTO v_template_id;

  INSERT INTO directory.packet_template_tasks (
    organization_id,
    packet_template_id,
    task_key,
    title,
    description,
    sort_order,
    is_required,
    default_owner_type,
    due_days
  )
  SELECT
    p_organization_id,
    v_template_id,
    btrim(task->>'task_key'),
    btrim(task->>'title'),
    NULLIF(btrim(task->>'description'), ''),
    COALESCE((task->>'sort_order')::INTEGER, ordinality::INTEGER),
    COALESCE((task->>'is_required')::BOOLEAN, true),
    COALESCE(NULLIF(task->>'owner_type', ''), 'hr'),
    NULLIF(task->>'due_days', '')::INTEGER
  FROM jsonb_array_elements(p_tasks) WITH ORDINALITY AS rows(task, ordinality);

  RETURN v_template_id;
END;
$$;

REVOKE ALL ON FUNCTION directory.create_packet_template(
  UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION directory.create_packet_template(
  UUID, TEXT, TEXT, TEXT, JSONB
) TO service_role;

NOTIFY pgrst, 'reload schema';
