-- overtime_groups had SELECT-only for authenticated; admin RLS policy exists
-- but updates from the app returned 403 until UPDATE is granted.

GRANT UPDATE ON public.overtime_groups TO authenticated;

COMMENT ON TABLE public.overtime_groups IS
  'OT approval groups. authenticated has UPDATE; RLS limits writes to active admins.';
