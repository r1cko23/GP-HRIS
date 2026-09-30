-- Client/position People grants: roster-only, client editor, position AMs.

INSERT INTO public.hris_capabilities (key, kind, label, description, sort_order) VALUES
  (
    'fn:clients.roster.view',
    'function',
    'Client roster view',
    'Open People clients and rosters; not 201 files',
    410
  ),
  (
    'fn:clients.update',
    'function',
    'Edit clients',
    'Create/update Directory client company fields',
    411
  ),
  (
    'fn:positions.create',
    'function',
    'Create positions',
    'Draft Directory position rate cards',
    412
  ),
  (
    'fn:positions.update',
    'function',
    'Edit positions',
    'Edit and submit Directory position rate cards',
    413
  ),
  (
    'fn:positions.approve.hotel',
    'function',
    'Approve Hotel positions',
    'Approve/reject pending position cards for Hotel clients',
    414
  ),
  (
    'fn:positions.approve.non_hotel',
    'function',
    'Approve Non-Hotel positions',
    'Approve/reject pending position cards for Non-Hotel clients',
    415
  )
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Admin keeps every capability via sync; also grant explicitly for safety.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, c.key
FROM public.users u
CROSS JOIN public.hris_capabilities c
WHERE u.role = 'admin'
  AND u.is_active = true
  AND c.key IN (
    'fn:clients.roster.view',
    'fn:clients.update',
    'fn:positions.create',
    'fn:positions.update',
    'fn:positions.approve.hotel',
    'fn:positions.approve.non_hotel'
  )
ON CONFLICT DO NOTHING;

-- Lea Valdez — client editor + position drafts (no 201 sections).
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, k.capability_key
FROM public.users u
CROSS JOIN (
  VALUES
    ('page:employees'),
    ('fn:clients.roster.view'),
    ('fn:clients.update'),
    ('fn:positions.create'),
    ('fn:positions.update')
) AS k(capability_key)
WHERE u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;

-- Michelle Razal — Hotel position AM + roster view.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, k.capability_key
FROM public.users u
CROSS JOIN (
  VALUES
    ('page:employees'),
    ('fn:clients.roster.view'),
    ('fn:positions.approve.hotel')
) AS k(capability_key)
WHERE u.is_active = true
  AND lower(u.email) IN (
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;

-- Michael Magbag — Non-Hotel position AM + roster view.
INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT u.id, k.capability_key
FROM public.users u
CROSS JOIN (
  VALUES
    ('page:employees'),
    ('fn:clients.roster.view'),
    ('fn:positions.approve.non_hotel')
) AS k(capability_key)
WHERE u.is_active = true
  AND lower(u.email) IN (
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
ON CONFLICT DO NOTHING;
