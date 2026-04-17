-- Secure RPC for toggling salary access from Settings.
-- Avoids direct UPDATE on public.users from client (RLS 403).

CREATE OR REPLACE FUNCTION public.set_user_salary_access(
  p_target_user_id uuid,
  p_can_access_salary boolean
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
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role NOT IN ('admin', 'hr', 'head_of_hr', 'hr_admin', 'hr_compben') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Only admins can modify admin accounts.
  IF v_actor_role <> 'admin' AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_target_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.users
  SET can_access_salary = p_can_access_salary
  WHERE id = p_target_user_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_salary_access(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_salary_access(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.set_user_salary_access(uuid, boolean) IS
  'Toggle users.can_access_salary. Admin and HR-family can manage non-admins; admin can manage all.';
