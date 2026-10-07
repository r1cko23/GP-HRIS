-- Employee sessions may only be issued and validated by trusted server routes.
-- The earlier migration exposed these SECURITY DEFINER helpers to anon clients.

REVOKE EXECUTE ON FUNCTION public.issue_employee_portal_session(
  UUID, INTEGER, TEXT, TEXT
) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_employee_portal_session(
  TEXT, UUID
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_employee_portal_session(
  UUID, INTEGER, TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_employee_portal_session(
  TEXT, UUID
) TO service_role;
