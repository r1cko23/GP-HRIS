-- Opening 13th / SIL YTD from GREENHRISMAIN payroll_summary (catalog import).
-- One row per Directory person per 13th-month year (latest kinsena).

CREATE TABLE IF NOT EXISTS public.payroll_main_accrual_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES directory.clients (id) ON DELETE CASCADE,
  legacy_employee_id INTEGER,
  as_of_period_start DATE NOT NULL,
  as_of_period_end DATE NOT NULL,
  basic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  thirteenth_month NUMERIC(12, 2) NOT NULL DEFAULT 0,
  thirteenth_month_ytd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sil_cutoff NUMERIC(12, 2) NOT NULL DEFAULT 0,
  thirteenmonthyear INTEGER NOT NULL,
  last_name TEXT,
  first_name TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (directory_employee_id, thirteenmonthyear)
);

CREATE INDEX IF NOT EXISTS payroll_main_accrual_openings_client_idx
  ON public.payroll_main_accrual_openings (client_id, as_of_period_end DESC);

ALTER TABLE public.payroll_main_accrual_openings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_main_accrual_openings_service ON public.payroll_main_accrual_openings;
CREATE POLICY payroll_main_accrual_openings_service ON public.payroll_main_accrual_openings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_main_accrual_openings TO service_role;

NOTIFY pgrst, 'reload schema';
