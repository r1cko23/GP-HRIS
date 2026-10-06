CREATE TABLE IF NOT EXISTS public.payroll_payslip_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.payroll_register_runs (id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.payroll_register_lines (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  directory_employee_id UUID,
  employee_name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_payslip_sends_run_line_key UNIQUE (run_id, line_id)
);

CREATE INDEX IF NOT EXISTS payroll_payslip_sends_run_idx
  ON public.payroll_payslip_sends (run_id, status);

ALTER TABLE public.payroll_payslip_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_payslip_sends_service ON public.payroll_payslip_sends;
CREATE POLICY payroll_payslip_sends_service ON public.payroll_payslip_sends
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_payslip_sends TO service_role;

COMMENT ON TABLE public.payroll_payslip_sends IS
  'One row per register line after payroll presses Send. Missing email is skipped. Posting does not send.';
