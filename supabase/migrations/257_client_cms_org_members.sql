-- Ensure Lea / Michelle / Michael can act on Directory orgs (membership gate).

INSERT INTO directory.organization_members (
  organization_id,
  user_id,
  role,
  is_active
)
SELECT o.id, u.id, 'hr', true
FROM directory.organizations o
CROSS JOIN public.users u
WHERE u.is_active = true
  AND lower(u.email) IN (
    'llvaldez@greenpasture.ph',
    'lea.valdez@greenpasture.ph',
    'michrazal@greenpasture.ph',
    'michelle.razal@greenpasture.ph',
    'mjmagbag@greenpasture.ph',
    'michael.magbag@greenpasture.ph'
  )
ON CONFLICT (organization_id, user_id) DO UPDATE
SET is_active = true;
