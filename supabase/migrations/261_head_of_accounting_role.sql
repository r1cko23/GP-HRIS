-- Head of Accounting is a dashboard role, not system Admin.
-- Keep directory RLS open for this role the same way HR family is.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'admin',
      'head_of_accounting',
      'head_of_hr',
      'hr_admin',
      'hr_compben',
      'approver',
      'viewer',
      'employee',
      'account_manager',
      'ot_approver',
      'ot_viewer'
    )
  );

CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND is_active = true
      AND (
        role = 'admin'
        OR role = 'head_of_accounting'
        OR public.is_hr_role_family(role)
      )
  );
$$;

UPDATE public.users
SET role = 'head_of_accounting'
WHERE is_active = true
  AND lower(email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph'
  );
