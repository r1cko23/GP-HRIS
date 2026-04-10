-- =====================================================
-- 176: set_user_permissions RPC (ACL matrix save)
-- =====================================================
-- Problem: PATCH public.users from the app hits RLS. Only
-- "Admins can manage users" applies to updates; HR users (or
-- mis-matched role checks) get 42501 permission denied.
--
-- Fix: SECURITY DEFINER function updates only `permissions`,
-- callable by admin and HR. HR cannot change admin accounts.
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_user_permissions(
  p_target_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_actor_role := public.get_user_role();
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('admin', 'hr') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role = 'hr' THEN
    IF EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_target_user_id
        AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  UPDATE public.users
  SET permissions = p_permissions
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_permissions(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_permissions(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.set_user_permissions(uuid, jsonb) IS
  'Updates users.permissions for the ACL matrix. Admin: any user. HR: non-admin users only. Bypasses RLS safely.';
