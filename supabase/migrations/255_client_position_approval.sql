-- Client industry (Hotel / Non-Hotel) + position rate-card approval workflow.
-- Lea drafts positions; Michelle approves Hotel; Michael approves Non-Hotel.

ALTER TABLE directory.clients
  ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'NON-HOTEL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_industry_check'
      AND conrelid = 'directory.clients'::regclass
  ) THEN
    ALTER TABLE directory.clients
      ADD CONSTRAINT clients_industry_check
      CHECK (industry IN ('HOTEL', 'NON-HOTEL'));
  END IF;
END $$;

COMMENT ON COLUMN directory.clients.industry IS
  'Routes position approval: HOTEL → Michelle; NON-HOTEL → Michael.';

ALTER TABLE directory.positions
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_approval_status_check'
      AND conrelid = 'directory.positions'::regclass
  ) THEN
    ALTER TABLE directory.positions
      ADD CONSTRAINT positions_approval_status_check
      CHECK (
        approval_status IN ('draft', 'pending', 'approved', 'rejected')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS positions_approval_status_idx
  ON directory.positions (client_id, approval_status);

CREATE INDEX IF NOT EXISTS clients_industry_idx
  ON directory.clients (organization_id, industry);

-- Movements store destination position UUID (title text remains for legacy rows).
ALTER TABLE directory.employee_movements
  ADD COLUMN IF NOT EXISTS position_id UUID
    REFERENCES directory.positions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employee_movements_position_id_idx
  ON directory.employee_movements (position_id);

-- Existing cards with both rates are treated as approved; others stay draft.
UPDATE directory.positions
SET
  approval_status = 'approved',
  reviewed_at = COALESCE(reviewed_at, now())
WHERE payroll_daily_rate IS NOT NULL
  AND billing_daily_rate IS NOT NULL
  AND approval_status = 'draft';
