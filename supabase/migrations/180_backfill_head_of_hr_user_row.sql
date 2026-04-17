-- Backfill users row for Head of HR auth account.
-- Fixes role loading and empty navigation when auth user exists but public.users row is missing.

WITH target_auth AS (
  SELECT
    id,
    email
  FROM auth.users
  WHERE lower(email) = lower('hrlrelations@greenpasture.ph')
  LIMIT 1
)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  is_active,
  can_access_salary,
  permissions
)
SELECT
  ta.id,
  ta.email,
  'Miss Merry',
  'head_of_hr',
  true,
  true,
  NULL
FROM target_auth ta
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = COALESCE(NULLIF(public.users.full_name, ''), EXCLUDED.full_name),
  role = 'head_of_hr',
  is_active = true,
  can_access_salary = true,
  permissions = NULL;

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'full_name', 'Miss Merry',
    'display_name', 'Miss Merry'
  )
WHERE lower(email) = lower('hrlrelations@greenpasture.ph');
