-- Reset Head of HR ACL row when users.permissions or RPC merged matrix denies all reads
-- (symptom: sidebar "No navigation items available" while dashboard still loads).
-- Re-run role assignment from 178 for this mailbox; clear custom permissions so defaults apply.

UPDATE public.users
SET
  role = 'head_of_hr',
  can_access_salary = COALESCE(can_access_salary, true),
  permissions = NULL
WHERE lower(email) = lower('hrlrelations@greenpasture.ph');
