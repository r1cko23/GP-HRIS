-- Distinct Pag-IBIG MPL and Safe Loan types for remittance reports.

ALTER TABLE public.employee_loans
  DROP CONSTRAINT IF EXISTS employee_loans_loan_type_check;

ALTER TABLE public.employee_loans
  ADD CONSTRAINT employee_loans_loan_type_check
  CHECK (
    loan_type IN (
      'company',
      'sss_calamity',
      'pagibig_calamity',
      'sss',
      'pagibig',
      'pagibig_mpl',
      'pagibig_safe',
      'emergency',
      'other'
    )
  );

COMMENT ON COLUMN public.employee_loans.loan_type IS
  'Type of loan: company, sss, sss_calamity, pagibig (legacy), pagibig_mpl, pagibig_safe, pagibig_calamity, emergency, other';
