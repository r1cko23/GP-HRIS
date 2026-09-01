-- Keep hris_user_grants aligned with users.permissions (+ role defaults).
-- Settings saves users.permissions via set_user_permissions; the sidebar also
-- reads hris_user_grants. Sparse/stale grants previously hid People/Time/Payroll.

CREATE OR REPLACE FUNCTION public.sync_hris_user_grants(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_can_access_salary boolean;
  v_effective jsonb;
  v_actor uuid := auth.uid();
BEGIN
  SELECT role, COALESCE(can_access_salary, false)
  INTO v_role, v_can_access_salary
  FROM public.users
  WHERE id = p_user_id;

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.hris_user_grants WHERE user_id = p_user_id;

  IF v_role = 'admin' THEN
    INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
    SELECT p_user_id, c.key, v_actor
    FROM public.hris_capabilities c
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  v_effective := public.get_user_permissions(p_user_id);

  INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
  SELECT p_user_id, 'page:' || mod.key, v_actor
  FROM jsonb_each(COALESCE(v_effective, '{}'::jsonb)) AS mod(key, val)
  WHERE (mod.val->>'read')::boolean IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.hris_capabilities c WHERE c.key = 'page:' || mod.key
    )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
  SELECT p_user_id, 'fn:' || mod.key || '.' || act, v_actor
  FROM jsonb_each(COALESCE(v_effective, '{}'::jsonb)) AS mod(key, val)
  CROSS JOIN LATERAL unnest(ARRAY['create', 'update', 'delete']) AS act
  WHERE (mod.val->>act)::boolean IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.hris_capabilities c
      WHERE c.key = 'fn:' || mod.key || '.' || act
    )
  ON CONFLICT DO NOTHING;

  IF v_can_access_salary THEN
    INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
    VALUES (p_user_id, 'fn:salary.read', v_actor)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_hris_user_grants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_hris_user_grants(uuid) TO service_role;

COMMENT ON FUNCTION public.sync_hris_user_grants(uuid) IS
  'Rebuilds hris_user_grants from get_user_permissions + can_access_salary. Used by ACL save paths.';

CREATE OR REPLACE FUNCTION public.set_user_permissions(
  p_target_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_actor_role := public.get_user_role();
  IF v_actor_role IS NULL
     OR (v_actor_role <> 'admin' AND NOT public.is_hr_role_family(v_actor_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_actor_role <> 'admin' THEN
    IF EXISTS (
      SELECT 1
      FROM public.users
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

  PERFORM public.sync_hris_user_grants(p_target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_salary_access(
  p_target_user_id uuid,
  p_can_access_salary boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF v_actor_role <> 'admin' AND NOT public.is_hr_role_family(v_actor_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

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

  PERFORM public.sync_hris_user_grants(p_target_user_id);
END;
$$;

-- One-time backfill so existing sparse grants match effective ACL.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.users
    WHERE is_active = true
  LOOP
    PERFORM public.sync_hris_user_grants(r.id);
  END LOOP;
END;
$$;
