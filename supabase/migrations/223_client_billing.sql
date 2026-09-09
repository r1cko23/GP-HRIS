-- Client billing from a posted payroll register (GREENHRISMAIN BILLINGPROCESSNEW grain).
-- Same hours × billing rates, then Client admin fee / VAT / EWT wrap.

CREATE TABLE IF NOT EXISTS public.billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  payroll_register_run_id UUID NOT NULL REFERENCES public.payroll_register_runs (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed', 'cancelled')),
  billing_reference TEXT NOT NULL,
  billing_date DATE NOT NULL,
  line_count INTEGER NOT NULL DEFAULT 0,
  fees JSONB NOT NULL DEFAULT '{}'::jsonb,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_runs_cutoff_processed_key
  ON public.billing_runs (cutoff_period_id)
  WHERE status = 'processed';

CREATE INDEX IF NOT EXISTS billing_runs_org_client_idx
  ON public.billing_runs (organization_id, client_id, billing_date DESC);

CREATE TABLE IF NOT EXISTS public.billing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.billing_runs (id) ON DELETE CASCADE,
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  source_register_line_id UUID REFERENCES public.payroll_register_lines (id) ON DELETE SET NULL,
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  billing_daily_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  billing_hourly_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  amounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  labor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mandatories NUMERIC(12, 2) NOT NULL DEFAULT 0,
  billable NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_lines_run_source_key UNIQUE (run_id, source_register_line_id)
);

CREATE INDEX IF NOT EXISTS billing_lines_run_idx
  ON public.billing_lines (run_id, last_name);

ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_runs_service ON public.billing_runs;
CREATE POLICY billing_runs_service ON public.billing_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS billing_lines_service ON public.billing_lines;
CREATE POLICY billing_lines_service ON public.billing_lines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_lines TO service_role;

NOTIFY pgrst, 'reload schema';
