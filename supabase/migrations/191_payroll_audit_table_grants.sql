-- Grant table access for payroll audit tables (RLS policies enforce row access)

GRANT SELECT, INSERT, UPDATE ON public.payroll_summary_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payroll_audit_client_employees TO authenticated;
