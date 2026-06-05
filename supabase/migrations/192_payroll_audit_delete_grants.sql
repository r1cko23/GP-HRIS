-- Allow admin/HR to delete payroll audit uploads and client employee roster

GRANT DELETE ON public.payroll_summary_uploads TO authenticated;
GRANT DELETE ON public.payroll_audit_client_employees TO authenticated;

CREATE POLICY "Admin HR can delete payroll summary uploads"
  ON public.payroll_summary_uploads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'admin'
          OR public.is_hr_role_family(u.role)
        )
    )
  );

CREATE POLICY "Admin HR can delete payroll audit client employees"
  ON public.payroll_audit_client_employees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND (
          u.role = 'admin'
          OR public.is_hr_role_family(u.role)
        )
    )
  );
