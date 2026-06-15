-- Payroll audit clients (companies table + RLS for admin/HR)

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_active_name
  ON public.companies (is_active, name);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin HR can read companies" ON public.companies;
CREATE POLICY "Admin HR can read companies"
  ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

DROP POLICY IF EXISTS "Admin HR can insert companies" ON public.companies;
CREATE POLICY "Admin HR can insert companies"
  ON public.companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

DROP POLICY IF EXISTS "Admin HR can update companies" ON public.companies;
CREATE POLICY "Admin HR can update companies"
  ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true
        AND (u.role = 'admin' OR public.is_hr_role_family(u.role))
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;

COMMENT ON TABLE public.companies IS
  'Payroll audit clients — one row per external employer whose registers are uploaded for comparison.';
