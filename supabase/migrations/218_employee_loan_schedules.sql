-- Per-cutoff loan installments (GREENHRISMAIN loanschedule grain).
-- Payroll register matches period_start to the cutoff start and posts amount_paid.

ALTER TABLE public.employee_loans
  ADD COLUMN IF NOT EXISTS legacy_id BIGINT,
  ADD COLUMN IF NOT EXISTS directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS particular TEXT,
  ADD COLUMN IF NOT EXISTS payment_term TEXT;

UPDATE public.employee_loans
SET payment_term = CASE
  WHEN deduct_bi_monthly IS FALSE THEN 'monthly'
  ELSE 'semi-monthly'
END
WHERE payment_term IS NULL;

ALTER TABLE public.employee_loans
  ALTER COLUMN payment_term SET DEFAULT 'semi-monthly';

ALTER TABLE public.employee_loans
  ALTER COLUMN payment_term SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employee_loans_payment_term_check'
  ) THEN
    ALTER TABLE public.employee_loans
      ADD CONSTRAINT employee_loans_payment_term_check
      CHECK (payment_term IN ('monthly', 'semi-monthly'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employee_loans_legacy_id_key
  ON public.employee_loans (legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_loans_directory_employee_idx
  ON public.employee_loans (directory_employee_id)
  WHERE directory_employee_id IS NOT NULL;

COMMENT ON COLUMN public.employee_loans.legacy_id IS 'GREENHRISMAIN dbo.loan.idloan';
COMMENT ON COLUMN public.employee_loans.particular IS 'Legacy loan.particular label (Cash Advance, SSS Loan, …)';
COMMENT ON COLUMN public.employee_loans.payment_term IS 'monthly = one installment per month on cutoff_assignment; semi-monthly = every kinsena';

UPDATE public.employee_loans el
SET directory_employee_id = e.directory_employee_id
FROM public.employees e
WHERE e.id = el.employee_id
  AND el.directory_employee_id IS NULL
  AND e.directory_employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.employee_loan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.employee_loans (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'skipped')),
  legacy_id BIGINT,
  posted_run_id UUID REFERENCES public.payroll_register_runs (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_loan_schedules_loan_period_key UNIQUE (loan_id, period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_loan_schedules_legacy_id_key
  ON public.employee_loan_schedules (legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_loan_schedules_due_idx
  ON public.employee_loan_schedules (loan_id, status, period_start);

COMMENT ON TABLE public.employee_loan_schedules IS
  'One installment per cutoff. Build register matches period_start; Post payroll marks paid and reduces employee_loans.current_balance.';

ALTER TABLE public.payroll_register_loan_posts
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.employee_loan_schedules (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE SET NULL;

ALTER TABLE public.employee_loan_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_loan_schedules_select ON public.employee_loan_schedules;
CREATE POLICY employee_loan_schedules_select ON public.employee_loan_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.can_access_salary = true
        AND users.is_active = true
    )
  );

DROP POLICY IF EXISTS employee_loan_schedules_write ON public.employee_loan_schedules;
CREATE POLICY employee_loan_schedules_write ON public.employee_loan_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.is_active = true
        AND users.role IN ('admin', 'head_of_hr', 'hr_admin', 'hr_compben', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.is_active = true
        AND users.role IN ('admin', 'head_of_hr', 'hr_admin', 'hr_compben', 'hr')
    )
  );

DROP POLICY IF EXISTS employee_loan_schedules_service ON public.employee_loan_schedules;
CREATE POLICY employee_loan_schedules_service ON public.employee_loan_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loan_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loan_schedules TO authenticated;

NOTIFY pgrst, 'reload schema';
