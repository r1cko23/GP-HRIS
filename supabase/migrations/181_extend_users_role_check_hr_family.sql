-- Extend users.role constraint for HR role family while keeping existing roles.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'admin',
      'hr',
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
