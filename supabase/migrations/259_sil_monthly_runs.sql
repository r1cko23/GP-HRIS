-- =====================================================
-- 259: SIL monthly runs (draft → approved → posted)
-- One active run per organization + client + year + month
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sil_monthly_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted', 'void')),
  line_count INTEGER NOT NULL DEFAULT 0,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  built_at TIMESTAMPTZ,
  built_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sil_monthly_runs_active_period_uidx
  ON public.sil_monthly_runs (organization_id, client_id, year, month)
  WHERE status IN ('draft', 'approved', 'posted');

CREATE INDEX IF NOT EXISTS sil_monthly_runs_org_client_idx
  ON public.sil_monthly_runs (organization_id, client_id, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS sil_monthly_runs_org_status_idx
  ON public.sil_monthly_runs (organization_id, status);

CREATE TABLE IF NOT EXISTS public.sil_monthly_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.sil_monthly_runs (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  hire_date DATE,
  employment_status TEXT,
  daily_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  days_worked NUMERIC(12, 4) NOT NULL DEFAULT 0,
  months NUMERIC(12, 6) NOT NULL DEFAULT 0,
  computation NUMERIC(12, 6) NOT NULL DEFAULT 0,
  days_entitlement NUMERIC(12, 4) NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remarks TEXT,
  window_from DATE,
  window_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sil_monthly_run_lines_run_employee_key UNIQUE (run_id, directory_employee_id)
);

CREATE INDEX IF NOT EXISTS sil_monthly_run_lines_run_idx
  ON public.sil_monthly_run_lines (run_id);

ALTER TABLE public.sil_monthly_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sil_monthly_run_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sil_monthly_runs_service ON public.sil_monthly_runs;
CREATE POLICY sil_monthly_runs_service ON public.sil_monthly_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sil_monthly_run_lines_service ON public.sil_monthly_run_lines;
CREATE POLICY sil_monthly_run_lines_service ON public.sil_monthly_run_lines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sil_monthly_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sil_monthly_run_lines TO service_role;

NOTIFY pgrst, 'reload schema';
