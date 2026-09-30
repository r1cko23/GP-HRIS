-- Michelle Razal: admin dashboard plus every payroll function.
-- Approver is locked to Time in middleware, and cutoff hour edits plus
-- payslip approval require role = admin. Existing People and Time grants stay.

UPDATE public.users
SET
  role = 'admin',
  can_access_salary = true
WHERE is_active = true
  AND lower(email) = 'michrazal@greenpasture.ph';

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, c.key
FROM public.users u
CROSS JOIN public.hris_capabilities c
WHERE u.is_active = true
  AND lower(u.email) = 'michrazal@greenpasture.ph'
  AND c.key IN (
    'page:dashboard',
    'page:executive',
    'page:reports',
    'page:payslips',
    'fn:payslips.create',
    'fn:payslips.update',
    'fn:payslips.approve',
    'fn:salary.read'
  )
ON CONFLICT DO NOTHING;
