-- Final legacy role cleanup: remove remaining direct `hr` role checks.

CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_user_id uuid,
  p_new_password text,
  p_reset_by uuid
)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resetter_role TEXT;
  v_password_hash TEXT;
BEGIN
  SELECT role INTO v_resetter_role
  FROM public.users
  WHERE id = p_reset_by
    AND is_active = true;

  IF v_resetter_role IS NULL
     OR (v_resetter_role <> 'admin' AND NOT public.is_hr_role_family(v_resetter_role)) THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized. Only admin or Head of HR family can reset passwords.'::TEXT;
    RETURN;
  END IF;

  IF LENGTH(TRIM(p_new_password)) < 6 THEN
    RETURN QUERY SELECT FALSE, 'Password must be at least 6 characters long'::TEXT;
    RETURN;
  END IF;

  v_password_hash := crypt(p_new_password, gen_salt('bf', 10));

  UPDATE public.users
  SET
    password_hash = v_password_hash,
    password_reset_token = NULL,
    password_reset_expires = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
