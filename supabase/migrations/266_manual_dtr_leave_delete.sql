-- DTR save replaces a previous Manual DTR SIL/LWOP by deleting that leave row.
-- leave_requests had UPDATE policies only, so the browser delete removed nothing
-- and the old SIL stayed on the sheet after a later punch save.

DROP POLICY IF EXISTS "Admin/HR can delete manual DTR leave" ON public.leave_requests;

CREATE POLICY "Admin/HR can delete manual DTR leave"
  ON public.leave_requests
  FOR DELETE
  TO authenticated
  USING (
    reason = 'Manual DTR'
    AND (
      get_user_role() = 'admin'
      OR public.is_hr_role_family(get_user_role())
      OR (
        public.is_group_approver_role(get_user_role())
        AND can_user_manage_leave_request(employee_id)
      )
    )
  );
