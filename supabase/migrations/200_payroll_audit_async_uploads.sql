-- =====================================================
-- 200: Async payroll audit uploads + storage bucket
-- =====================================================

ALTER TABLE public.payroll_summary_uploads
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS rollup_gap_centavos BIGINT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Existing rows with parsed periods are already complete
UPDATE public.payroll_summary_uploads
SET status = 'ready', processed_at = uploaded_at
WHERE period_start IS NOT NULL
  AND status = 'ready'
  AND processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_summary_uploads_status
  ON public.payroll_summary_uploads (company_id, status, uploaded_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payroll-audit-files', 'payroll-audit-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.payroll_summary_uploads.status IS
  'processing = queued/parsing; ready = centavo-validated; failed = parse or tie-out error';

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payroll_summary_uploads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
