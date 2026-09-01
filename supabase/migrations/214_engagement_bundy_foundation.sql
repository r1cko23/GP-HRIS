-- Engagement + Bundy enrollment foundation (ADR 0008)
-- - clients.bundy_enabled drives auto-enroll after Engagement hire/rehire
-- - seed Organic house client + HR membership on Organic org

ALTER TABLE directory.clients
  ADD COLUMN IF NOT EXISTS bundy_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN directory.clients.bundy_enabled IS
  'When true, Engagement hire/rehire best-effort creates/links public.employees for Clock.';

-- Organic house client (GREEN PASTURE PEOPLE MANAGEMENT INC.)
UPDATE directory.clients
SET bundy_enabled = true,
    updated_at = now()
WHERE id = '16556bfe-6893-49ae-b98d-fd82d7292348';

-- head_of_hr → Organic membership (hybrid tenant gate: HR needs membership)
INSERT INTO directory.organization_members (organization_id, user_id, role, is_active)
VALUES
  (
    '5edc1024-c785-4044-9a7e-758d422ccba6',
    'eb401acd-7155-4eec-b080-788fb195a4a5',
    'hr',
    true
  ),
  (
    '5edc1024-c785-4044-9a7e-758d422ccba6',
    '2c8dc5c8-24b8-49ee-b6b3-dfa43d848228',
    'hr',
    true
  )
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    is_active = true;
