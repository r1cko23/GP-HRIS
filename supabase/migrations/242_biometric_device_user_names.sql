-- =====================================================
-- 242: Device-side user names from OPERLOG / USERINFO
-- =====================================================
-- ATTLOG only has PIN. Names live on the terminal and arrive via OPERLOG
-- or DATA QUERY USERINFO so HR can map PIN → employee by name.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.biometric_device_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.biometric_devices (id) ON DELETE CASCADE,
  device_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT biometric_device_users_device_pin_key UNIQUE (device_id, device_user_id)
);

COMMENT ON TABLE public.biometric_device_users IS
  'Names enrolled on the biometric terminal (PIN + Name from OPERLOG/USERINFO).';

CREATE INDEX IF NOT EXISTS biometric_device_users_name_idx
  ON public.biometric_device_users (device_id, lower(display_name));

ALTER TABLE public.biometric_devices
  ADD COLUMN IF NOT EXISTS pending_command TEXT,
  ADD COLUMN IF NOT EXISTS operlog_stamp TEXT;

ALTER TABLE public.biometric_device_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS biometric_device_users_select ON public.biometric_device_users;
CREATE POLICY biometric_device_users_select ON public.biometric_device_users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS biometric_device_users_manage_admin_hr ON public.biometric_device_users;
CREATE POLICY biometric_device_users_manage_admin_hr ON public.biometric_device_users
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_device_users TO authenticated;
