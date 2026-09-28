-- Cutoff-scoped refunds for Organic/Deployed register (earnings.adjustment).

CREATE TABLE IF NOT EXISTS public.employee_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE CASCADE,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE CASCADE,
  cutoff_period_id UUID NOT NULL REFERENCES public.cutoff_periods (id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_refunds_person_chk CHECK (
    directory_employee_id IS NOT NULL OR office_employee_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_refunds_dir_cutoff_uidx
  ON public.employee_refunds (cutoff_period_id, directory_employee_id)
  WHERE directory_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_refunds_office_cutoff_uidx
  ON public.employee_refunds (cutoff_period_id, office_employee_id)
  WHERE office_employee_id IS NOT NULL AND directory_employee_id IS NULL;

CREATE INDEX IF NOT EXISTS employee_refunds_cutoff_idx
  ON public.employee_refunds (cutoff_period_id)
  WHERE is_active = true;

ALTER TABLE public.employee_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_refunds_service ON public.employee_refunds;
CREATE POLICY employee_refunds_service ON public.employee_refunds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_refunds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_refunds TO authenticated;

COMMENT ON TABLE public.employee_refunds IS
  'Cutoff-scoped refund amounts applied as earnings.adjustment on register build';

COMMENT ON COLUMN public.employee_refunds.cutoff_period_id IS
  'Cutoff this refund applies to; register build only loads matching cutoff_period_id';
