-- =====================================================
-- 190: Per-client payroll audit (company scope + plantilla)
-- =====================================================

ALTER TABLE public.payroll_summary_uploads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'payroll_register'
    CHECK (document_type IN ('plantilla', 'payroll_register'));

ALTER TABLE public.payroll_summary_uploads
  ALTER COLUMN period_start DROP NOT NULL,
  ALTER COLUMN period_end DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_summary_uploads_company
  ON public.payroll_summary_uploads (company_id, document_type, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_summary_uploads_company_period
  ON public.payroll_summary_uploads (company_id, period_start, period_end, uploaded_at DESC)
  WHERE document_type = 'payroll_register';

CREATE TABLE IF NOT EXISTS public.payroll_audit_client_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  daily_rate NUMERIC(12, 2),
  position TEXT,
  hours_worked NUMERIC(12, 2),
  gross_amount NUMERIC(14, 2),
  net_amount NUMERIC(14, 2),
  sil_cutoff NUMERIC(14, 2),
  plantilla_upload_id UUID REFERENCES public.payroll_summary_uploads(id) ON DELETE SET NULL,
  register_upload_id UUID REFERENCES public.payroll_summary_uploads(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_payroll_audit_client_employees_company
  ON public.payroll_audit_client_employees (company_id, display_name);

ALTER TABLE public.payroll_audit_client_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin HR can read payroll audit client employees"
  ON public.payroll_audit_client_employees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

CREATE POLICY "Admin HR can insert payroll audit client employees"
  ON public.payroll_audit_client_employees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

CREATE POLICY "Admin HR can update payroll audit client employees"
  ON public.payroll_audit_client_employees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

COMMENT ON TABLE public.payroll_audit_client_employees IS
  'Registered employee roster per client for payroll audit comparisons.';
