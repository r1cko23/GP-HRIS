-- BDO ATM debit-memo disbursement queue (1 posted run → 1 Debit Memo → 1 .txt → 1 BDO ref).

CREATE TABLE IF NOT EXISTS public.payroll_bdo_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  payroll_register_run_id UUID NOT NULL REFERENCES public.payroll_register_runs (id) ON DELETE CASCADE,
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  upload_date DATE NOT NULL,
  batch_no SMALLINT NOT NULL CHECK (batch_no BETWEEN 1 AND 99),
  company_code TEXT NOT NULL DEFAULT 'D7I',
  funding_account TEXT NOT NULL DEFAULT '2110254455',
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  file_sha256 TEXT,
  file_body TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_ref'
    CHECK (status IN ('awaiting_ref', 'confirmed', 'void')),
  bdo_reference TEXT,
  bdo_referenced_at TIMESTAMPTZ,
  bdo_referenced_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_bdo_disbursements_ref_when_confirmed CHECK (
    (status = 'confirmed' AND bdo_reference IS NOT NULL AND BTRIM(bdo_reference) <> '')
    OR status <> 'confirmed'
  )
);

COMMENT ON TABLE public.payroll_bdo_disbursements IS
  'One active BDO ATM credit file per posted Organic register run; bdo_reference locks the Debit Memo against double-pay.';

CREATE UNIQUE INDEX IF NOT EXISTS payroll_bdo_disbursements_active_run_uidx
  ON public.payroll_bdo_disbursements (payroll_register_run_id)
  WHERE status <> 'void';

CREATE UNIQUE INDEX IF NOT EXISTS payroll_bdo_disbursements_bdo_ref_uidx
  ON public.payroll_bdo_disbursements (organization_id, bdo_reference)
  WHERE bdo_reference IS NOT NULL AND BTRIM(bdo_reference) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payroll_bdo_disbursements_batch_uidx
  ON public.payroll_bdo_disbursements (organization_id, upload_date, batch_no)
  WHERE status <> 'void';

CREATE INDEX IF NOT EXISTS payroll_bdo_disbursements_org_status_idx
  ON public.payroll_bdo_disbursements (organization_id, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS payroll_bdo_disbursements_cutoff_idx
  ON public.payroll_bdo_disbursements (cutoff_period_id);

ALTER TABLE public.payroll_bdo_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_bdo_disbursements_service ON public.payroll_bdo_disbursements;
CREATE POLICY payroll_bdo_disbursements_service ON public.payroll_bdo_disbursements
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_bdo_disbursements TO service_role;
