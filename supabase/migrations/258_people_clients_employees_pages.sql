-- People hub split: Clients vs Employees Page grants.
-- Legacy page:employees remains as alias (both surfaces) in app code.

INSERT INTO public.hris_capabilities (key, kind, label, description, sort_order) VALUES
  (
    'page:people.clients',
    'page',
    'People · Clients',
    'Client list, client CMS, positions, and roster view',
    21
  ),
  (
    'page:people.employees',
    'page',
    'People · Employees',
    'Work queues, Add employee, and 201 lifecycle',
    22
  )
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Anyone who already has legacy page:employees gets both new pages (alias migrate).
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT g.user_id, k.capability_key
FROM public.hris_user_grants g
CROSS JOIN (
  VALUES
    ('page:people.clients'),
    ('page:people.employees')
) AS k(capability_key)
WHERE g.capability_key = 'page:employees'
ON CONFLICT DO NOTHING;

-- Client CMS / AM packs: Clients surface only (drop Employees page + legacy).
-- Lea Valdez
DELETE FROM public.hris_user_grants g
USING public.users u
WHERE g.user_id = u.id
  AND u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph'
  )
  AND g.capability_key IN ('page:employees', 'page:people.employees');

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'page:people.clients'
FROM public.users u
WHERE u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;

-- Michelle Razal
DELETE FROM public.hris_user_grants g
USING public.users u
WHERE g.user_id = u.id
  AND u.is_active = true
  AND lower(u.email) IN (
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph'
  )
  AND g.capability_key IN ('page:employees', 'page:people.employees');

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'page:people.clients'
FROM public.users u
WHERE u.is_active = true
  AND lower(u.email) IN (
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;

-- Michael Magbag
DELETE FROM public.hris_user_grants g
USING public.users u
WHERE g.user_id = u.id
  AND u.is_active = true
  AND lower(u.email) IN (
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
  AND g.capability_key IN ('page:employees', 'page:people.employees');

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, 'page:people.clients'
FROM public.users u
WHERE u.is_active = true
  AND lower(u.email) IN (
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;

-- Admins keep every capability via sync; grant explicitly for safety.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, c.key
FROM public.users u
CROSS JOIN public.hris_capabilities c
WHERE u.role = 'admin'
  AND u.is_active = true
  AND c.key IN ('page:people.clients', 'page:people.employees')
ON CONFLICT DO NOTHING;
