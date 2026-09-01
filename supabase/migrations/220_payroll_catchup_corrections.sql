-- Next-cutoff catch-up: peso corrections queued from a posted cutoff onto a later open cutoff.
-- See docs/adr/0012-next-cutoff-catchup.md.

CREATE TABLE IF NOT EXISTS public.payroll_catchup_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  source_cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  apply_cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  directory_employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'cancelled')),
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  applied_run_id UUID REFERENCES public.payroll_register_runs (id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_catchup_corrections_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT payroll_catchup_corrections_reason_len CHECK (char_length(trim(reason)) >= 3),
  CONSTRAINT payroll_catchup_corrections_distinct_cutoffs CHECK (
    source_cutoff_period_id <> apply_cutoff_period_id
  )
);

CREATE INDEX IF NOT EXISTS payroll_catchup_corrections_source_idx
  ON public.payroll_catchup_corrections (source_cutoff_period_id, status);

CREATE INDEX IF NOT EXISTS payroll_catchup_corrections_apply_idx
  ON public.payroll_catchup_corrections (apply_cutoff_period_id, status);

CREATE INDEX IF NOT EXISTS payroll_catchup_corrections_org_client_idx
  ON public.payroll_catchup_corrections (organization_id, client_id, created_at DESC);

ALTER TABLE public.payroll_catchup_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_catchup_corrections_service ON public.payroll_catchup_corrections;
CREATE POLICY payroll_catchup_corrections_service ON public.payroll_catchup_corrections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_catchup_corrections TO service_role;

NOTIFY pgrst, 'reload schema';
