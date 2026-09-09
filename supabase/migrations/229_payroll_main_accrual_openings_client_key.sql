-- A person can have MAIN YTD on more than one client (transfer / dual posting).
ALTER TABLE public.payroll_main_accrual_openings
  DROP CONSTRAINT IF EXISTS payroll_main_accrual_openings_directory_employee_id_thirtee_key;

ALTER TABLE public.payroll_main_accrual_openings
  DROP CONSTRAINT IF EXISTS payroll_main_accrual_openings_directory_employee_id_thirteenmonthyear_key;

ALTER TABLE public.payroll_main_accrual_openings
  DROP CONSTRAINT IF EXISTS payroll_main_accrual_openings_directory_employee_id_thirteenmo_key;

ALTER TABLE public.payroll_main_accrual_openings
  DROP CONSTRAINT IF EXISTS payroll_main_accrual_openings_person_client_year_key;

ALTER TABLE public.payroll_main_accrual_openings
  ADD CONSTRAINT payroll_main_accrual_openings_person_client_year_key
  UNIQUE (directory_employee_id, client_id, thirteenmonthyear);
