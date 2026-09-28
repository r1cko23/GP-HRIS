-- Standing itemized other deductions (PA, BDO Insurance, HMO, Uniform, Nameplate, ID).
-- Applied into Organic/Deployed register as other_deduction_lines.

CREATE TABLE IF NOT EXISTS public.employee_other_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_employee_id UUID REFERENCES directory.employees (id) ON DELETE CASCADE,
  office_employee_id UUID REFERENCES public.employees (id) ON DELETE CASCADE,
  deduction_key TEXT NOT NULL
    CHECK (
      deduction_key IN (
        'personal_accident',
        'bdo_insurance',
        'hmo',
        'uniform',
        'nameplate',
        'id_card'
      )
    ),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_other_deductions_person_chk CHECK (
    directory_employee_id IS NOT NULL OR office_employee_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_other_deductions_dir_key_uidx
  ON public.employee_other_deductions (directory_employee_id, deduction_key)
  WHERE directory_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_other_deductions_office_key_uidx
  ON public.employee_other_deductions (office_employee_id, deduction_key)
  WHERE office_employee_id IS NOT NULL AND directory_employee_id IS NULL;

CREATE INDEX IF NOT EXISTS employee_other_deductions_dir_active_idx
  ON public.employee_other_deductions (directory_employee_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS employee_other_deductions_office_active_idx
  ON public.employee_other_deductions (office_employee_id)
  WHERE is_active = true;

ALTER TABLE public.employee_other_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_other_deductions_service ON public.employee_other_deductions;
CREATE POLICY employee_other_deductions_service ON public.employee_other_deductions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_other_deductions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_other_deductions TO authenticated;

COMMENT ON TABLE public.employee_other_deductions IS
  'Standing itemized other deductions applied on posted register builds';
