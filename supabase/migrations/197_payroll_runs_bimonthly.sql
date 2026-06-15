-- Payroll runs (Addbell-style batch payroll, bi-monthly cutoffs for GP-HRIS)

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_start DATE NOT NULL,
  cutoff_end DATE NOT NULL,
  pay_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'processing', 'finalized', 'cancelled')),
  selected_employee_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_cutoff_start
  ON public.payroll_runs (cutoff_start DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_status
  ON public.payroll_runs (status);

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payslips_payroll_run_employee_uniq
  ON public.payslips (payroll_run_id, employee_id)
  WHERE payroll_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run_id
  ON public.payslips (payroll_run_id);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_runs_select_admin_hr ON public.payroll_runs;
CREATE POLICY payroll_runs_select_admin_hr ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'hr', 'head_of_hr', 'hr_admin', 'hr_compben')
    )
  );

DROP POLICY IF EXISTS payroll_runs_insert_admin_hr ON public.payroll_runs;
CREATE POLICY payroll_runs_insert_admin_hr ON public.payroll_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'hr', 'head_of_hr', 'hr_admin', 'hr_compben')
    )
  );

DROP POLICY IF EXISTS payroll_runs_update_admin_hr ON public.payroll_runs;
CREATE POLICY payroll_runs_update_admin_hr ON public.payroll_runs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'hr', 'head_of_hr', 'hr_admin', 'hr_compben')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.payroll_runs TO authenticated;

COMMENT ON TABLE public.payroll_runs IS
  'Bi-monthly payroll batch (Addbell payroll run pattern).';
