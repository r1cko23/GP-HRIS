-- Organic payroll register: posted lines from approved cutoff_hours.
-- Hybrid: weekly_attendance payslips remain; this is the cutoff → register spine.

CREATE TABLE IF NOT EXISTS public.payroll_register_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'void')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payroll_date DATE,
  line_count INTEGER NOT NULL DEFAULT 0,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  posted_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_register_runs_cutoff_key UNIQUE (cutoff_period_id)
);

CREATE INDEX IF NOT EXISTS payroll_register_runs_org_status_idx
  ON public.payroll_register_runs (organization_id, status);

CREATE TABLE IF NOT EXISTS public.payroll_register_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.payroll_register_runs (id) ON DELETE CASCADE,
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE SET NULL,
  employee_code TEXT,
  last_name TEXT,
  first_name TEXT,
  daily_rate NUMERIC(12, 4),
  monthly_salary NUMERIC(12, 4),
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  earnings JSONB NOT NULL DEFAULT '{}'::jsonb,
  deductions JSONB NOT NULL DEFAULT '{}'::jsonb,
  loan_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_register_lines_run_employee_key UNIQUE (run_id, directory_employee_id)
);

CREATE INDEX IF NOT EXISTS payroll_register_lines_run_idx
  ON public.payroll_register_lines (run_id);

CREATE TABLE IF NOT EXISTS public.payroll_register_loan_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.payroll_register_runs (id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.employee_loans (id) ON DELETE CASCADE,
  office_employee_id UUID NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  balance_before NUMERIC(12, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_register_loan_posts_run_loan_key UNIQUE (run_id, loan_id)
);

CREATE TABLE IF NOT EXISTS public.cutoff_hours_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_hours_id UUID NOT NULL REFERENCES public.cutoff_hours (id) ON DELETE CASCADE,
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  changed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  before_row JSONB,
  after_row JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cutoff_hours_audit_period_idx
  ON public.cutoff_hours_audit (cutoff_period_id, created_at DESC);

ALTER TABLE public.payroll_register_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_register_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_register_loan_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutoff_hours_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_register_runs_service ON public.payroll_register_runs;
CREATE POLICY payroll_register_runs_service ON public.payroll_register_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payroll_register_lines_service ON public.payroll_register_lines;
CREATE POLICY payroll_register_lines_service ON public.payroll_register_lines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payroll_register_loan_posts_service ON public.payroll_register_loan_posts;
CREATE POLICY payroll_register_loan_posts_service ON public.payroll_register_loan_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cutoff_hours_audit_service ON public.cutoff_hours_audit;
CREATE POLICY cutoff_hours_audit_service ON public.cutoff_hours_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_register_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_register_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_register_loan_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cutoff_hours_audit TO service_role;

NOTIFY pgrst, 'reload schema';
