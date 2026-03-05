-- Transfer all employees under Shyna Aya-Ay (OT approver) to HR Roxanne and deactivate Shyna's account.
-- Shyna is no longer an active employee.
-- Applied: 2026-03-05

-- 1. Reassign employee overtime approver from Shyna to Roxanne (HR Roxanne)
-- Shyna user id: e6a910c6-2e2c-4248-8fa1-ffd04f195e4a
-- Roxanne user id: 2c8dc5c8-24b8-49ee-b6b3-dfa43d848228
UPDATE public.employees
SET overtime_approver_id = '2c8dc5c8-24b8-49ee-b6b3-dfa43d848228'
WHERE overtime_approver_id = 'e6a910c6-2e2c-4248-8fa1-ffd04f195e4a';

-- 2. Deactivate Shyna Aya-Ay user account
UPDATE public.users
SET is_active = false
WHERE id = 'e6a910c6-2e2c-4248-8fa1-ffd04f195e4a';
