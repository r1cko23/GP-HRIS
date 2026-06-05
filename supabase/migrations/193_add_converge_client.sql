-- Add Converge client for payroll audit testing

INSERT INTO public.companies (name, slug, is_active)
VALUES (
  'Converge Info and Communications Tech Solutions Inc.',
  'converge',
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = NOW();
