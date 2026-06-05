-- =====================================================
-- 189: Payroll summary PDF uploads for audit comparison
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payroll_summary_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  source_file_name TEXT,
  source_format TEXT NOT NULL DEFAULT 'external_register'
    CHECK (source_format IN ('gp_hris', 'external_register')),
  company_name TEXT,
  payout_date DATE,
  employee_count INTEGER NOT NULL DEFAULT 0,
  hours_worked_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reg_ot_hours_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_ot_amount NUMERIC(14, 2),
  sil_total NUMERIC(14, 2),
  sil_cutoff_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gross_amount_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_amount_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  parsed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_base64 TEXT
);

CREATE INDEX IF NOT EXISTS idx_payroll_summary_uploads_period
  ON public.payroll_summary_uploads (period_start, period_end, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_summary_uploads_uploaded_at
  ON public.payroll_summary_uploads (uploaded_at DESC);

ALTER TABLE public.payroll_summary_uploads ENABLE ROW LEVEL SECURITY;

-- Admin / HR family can read all payroll summary uploads
CREATE POLICY "Admin HR can read payroll summary uploads"
  ON public.payroll_summary_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'admin'
          OR public.is_hr_role_family(u.role)
        )
    )
  );

-- Admin / HR family can insert payroll summary uploads
CREATE POLICY "Admin HR can insert payroll summary uploads"
  ON public.payroll_summary_uploads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'admin'
          OR public.is_hr_role_family(u.role)
        )
    )
    AND uploaded_by = auth.uid()
  );

COMMENT ON TABLE public.payroll_summary_uploads IS
  'Stored parsed metrics from uploaded Payroll Register / Payroll Summary PDFs for audit comparison.';
