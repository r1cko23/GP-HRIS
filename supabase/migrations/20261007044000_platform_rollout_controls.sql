CREATE TABLE public.platform_rollout_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  branch_id UUID REFERENCES directory.client_branches (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (
      status IN ('planned', 'pilot', 'expanded', 'retired', 'rolled_back')
    ),
  identity_enabled BOOLEAN NOT NULL DEFAULT false,
  demand_enabled BOOLEAN NOT NULL DEFAULT false,
  approved_work_enabled BOOLEAN NOT NULL DEFAULT false,
  pay_bill_enabled BOOLEAN NOT NULL DEFAULT false,
  legacy_paths_retired BOOLEAN NOT NULL DEFAULT false,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  exit_gate_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_off_cutoffs INTEGER NOT NULL DEFAULT 0
    CHECK (signed_off_cutoffs >= 0),
  started_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  rollback_reason TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (organization_id, client_id, branch_id),
  CHECK (
    NOT legacy_paths_retired
    OR (
      status = 'retired'
      AND identity_enabled
      AND demand_enabled
      AND approved_work_enabled
      AND pay_bill_enabled
      AND signed_off_cutoffs >= 2
      AND jsonb_array_length(exit_gate_blockers) = 0
    )
  )
);

CREATE INDEX platform_rollout_pilots_list_idx
  ON public.platform_rollout_pilots (
    organization_id,
    status,
    updated_at DESC
  );

ALTER TABLE public.platform_rollout_pilots ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_rollout_pilots_service
  ON public.platform_rollout_pilots FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.platform_rollout_pilots TO service_role;

COMMENT ON TABLE public.platform_rollout_pilots IS
  'Per-client strangler rollout controls. Legacy paths can be retired only after recorded exit gates and two signed-off cutoffs.';

NOTIFY pgrst, 'reload schema';
