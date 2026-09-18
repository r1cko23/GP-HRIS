-- People 201 section Functions + sync from employees.read / employee_sections.

INSERT INTO public.hris_capabilities (key, kind, label, description, sort_order) VALUES
  ('fn:employees.section.core', 'function', '201 core', 'Overview and job assignment', 401),
  ('fn:employees.section.government_ids', 'function', 'Government IDs', 'TIN, SSS, PhilHealth, Pag-IBIG numbers', 402),
  ('fn:employees.section.documents', 'function', '201 documents', 'ID scans and attachments', 403),
  ('fn:employees.section.pay_channel', 'function', 'Pay channel', 'Bank account and GCash', 404),
  ('fn:employees.section.family', 'function', 'Family', 'Contacts and dependents', 405),
  ('fn:employees.section.history', 'function', '201 history', 'Job history, education, licenses, skills', 406),
  ('fn:employees.section.medical', 'function', 'Medical', 'Medical sheet', 407),
  ('fn:employees.section.lifecycle', 'function', 'Lifecycle actions', 'Transfer, rehire, status lifecycle', 408)
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

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
  v_sections jsonb;
  v_section_key text;
  v_section_id text;
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
  WHERE mod.key <> 'employee_sections'
    AND jsonb_typeof(mod.val) = 'object'
    AND (mod.val->>'read')::boolean IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.hris_capabilities c WHERE c.key = 'page:' || mod.key
    )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
  SELECT p_user_id, 'fn:' || mod.key || '.' || act, v_actor
  FROM jsonb_each(COALESCE(v_effective, '{}'::jsonb)) AS mod(key, val)
  CROSS JOIN LATERAL unnest(ARRAY['create', 'update', 'delete']) AS act
  WHERE mod.key <> 'employee_sections'
    AND jsonb_typeof(mod.val) = 'object'
    AND (mod.val->>act)::boolean IS TRUE
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

  -- People 201 sections: default all when employees.read; else honor employee_sections map.
  IF COALESCE((v_effective->'employees'->>'read')::boolean, false) THEN
    v_sections := v_effective->'employee_sections';
    IF v_sections IS NULL OR jsonb_typeof(v_sections) <> 'object' THEN
      INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
      SELECT p_user_id, c.key, v_actor
      FROM public.hris_capabilities c
      WHERE c.key LIKE 'fn:employees.section.%'
      ON CONFLICT DO NOTHING;
    ELSE
      FOR v_section_id IN
        SELECT unnest(ARRAY[
          'core',
          'government_ids',
          'documents',
          'pay_channel',
          'family',
          'history',
          'medical',
          'lifecycle'
        ])
      LOOP
        IF COALESCE((v_sections->>v_section_id)::boolean, false) THEN
          v_section_key := 'fn:employees.section.' || v_section_id;
          IF EXISTS (
            SELECT 1 FROM public.hris_capabilities c WHERE c.key = v_section_key
          ) THEN
            INSERT INTO public.hris_user_grants (user_id, capability_key, granted_by)
            VALUES (p_user_id, v_section_key, v_actor)
            ON CONFLICT DO NOTHING;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.sync_hris_user_grants(uuid) IS
  'Rebuilds hris_user_grants from get_user_permissions + can_access_salary + employee_sections.';

-- Backfill so existing People readers keep all 201 sections.
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
