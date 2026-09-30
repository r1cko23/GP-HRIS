-- Lea, Michelle, and Michael are Clients-only.
-- 258 deleted their Employees page, then re-granted it to every admin.

DELETE FROM public.hris_user_grants g
USING public.users u
WHERE g.user_id = u.id
  AND u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph',
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph',
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
  AND (
    g.capability_key IN ('page:employees', 'page:people.employees')
    OR g.capability_key LIKE 'fn:employees.section.%'
  );

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'page:people.clients'
FROM public.users u
WHERE u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph',
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph',
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;
