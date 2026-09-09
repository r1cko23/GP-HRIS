-- Deployed loans live on Directory, not Bundy. employee_id (office clock)
-- is optional when directory_employee_id is set.

ALTER TABLE public.employee_loans
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.employee_loans
  DROP CONSTRAINT IF EXISTS employee_loans_person_required;

ALTER TABLE public.employee_loans
  ADD CONSTRAINT employee_loans_person_required
  CHECK (employee_id IS NOT NULL OR directory_employee_id IS NOT NULL);

ALTER TABLE public.payroll_register_loan_posts
  ALTER COLUMN office_employee_id DROP NOT NULL;

COMMENT ON COLUMN public.employee_loans.employee_id IS
  'Office Bundy employee. Null for Deployed people who are not enrolled in clock.';
