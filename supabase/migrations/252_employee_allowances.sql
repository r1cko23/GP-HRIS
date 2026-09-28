-- Standing allowances: Deployed TL (Epicurean/PLK); Organic Load + Supervisory.
-- Folded into register earnings.allowance on build.

CREATE TABLE IF NOT EXISTS public.employee_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE CASCADE,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE CASCADE,
  allowance_key TEXT NOT NULL
    CHECK (
      allowance_key IN (
        'tl_allowance',
        'load_allowance',
        'supervisory_allowance'
      )
    ),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_allowances_person_chk CHECK (
    directory_employee_id IS NOT NULL OR office_employee_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_allowances_dir_key_uidx
  ON public.employee_allowances (directory_employee_id, allowance_key)
  WHERE directory_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_allowances_office_key_uidx
  ON public.employee_allowances (office_employee_id, allowance_key)
  WHERE office_employee_id IS NOT NULL AND directory_employee_id IS NULL;

CREATE INDEX IF NOT EXISTS employee_allowances_dir_active_idx
  ON public.employee_allowances (directory_employee_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS employee_allowances_office_active_idx
  ON public.employee_allowances (office_employee_id)
  WHERE is_active = true;

ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_allowances_service ON public.employee_allowances;
CREATE POLICY employee_allowances_service ON public.employee_allowances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_allowances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_allowances TO authenticated;

COMMENT ON TABLE public.employee_allowances IS
  'Standing TL / Load / Supervisory allowances applied on register builds';

-- Persist itemized lines on posted register (other deductions + allowances).
ALTER TABLE public.payroll_register_lines
  ADD COLUMN IF NOT EXISTS other_deduction_lines JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.payroll_register_lines
  ADD COLUMN IF NOT EXISTS allowance_lines JSONB NOT NULL DEFAULT '[]'::jsonb;
