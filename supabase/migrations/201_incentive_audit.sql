-- =====================================================
-- 201: Incentive audit uploads (recruiter verification Excel)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.incentive_audit_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'failed')),
  error_message TEXT,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  already_received_count INTEGER NOT NULL DEFAULT 0,
  fuzzy_match_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  disapproved_count INTEGER NOT NULL DEFAULT 0,
  total_incentive_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  audit_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incentive_audit_uploads_uploaded_at
  ON public.incentive_audit_uploads (uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.incentive_audit_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES public.incentive_audit_uploads(id) ON DELETE CASCADE,
  sheet TEXT NOT NULL CHECK (sheet IN ('NON-HOTEL', 'HOTEL')),
  row_index INTEGER NOT NULL,
  industry TEXT,
  candidate_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  branch_client TEXT,
  position TEXT,
  recruiter TEXT,
  endorsement_date DATE,
  deployment_date DATE,
  hris_verification TEXT,
  status TEXT,
  total_hours NUMERIC(12, 2),
  total_days NUMERIC(12, 4),
  incentive_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_duplicate_in_file BOOLEAN NOT NULL DEFAULT false,
  is_already_received BOOLEAN NOT NULL DEFAULT false,
  is_fuzzy_match BOOLEAN NOT NULL DEFAULT false,
  match_score NUMERIC(5, 4),
  matched_name TEXT,
  matched_upload_id UUID REFERENCES public.incentive_audit_uploads(id) ON DELETE SET NULL,
  matched_row_id UUID,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incentive_audit_rows_upload
  ON public.incentive_audit_rows (upload_id, sheet, row_index);

CREATE INDEX IF NOT EXISTS idx_incentive_audit_rows_normalized
  ON public.incentive_audit_rows (normalized_name);

CREATE INDEX IF NOT EXISTS idx_incentive_audit_rows_received
  ON public.incentive_audit_rows (normalized_name)
  WHERE incentive_amount > 0 AND UPPER(COALESCE(status, '')) = 'APPROVED';

ALTER TABLE public.incentive_audit_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_audit_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read incentive audit uploads"
  ON public.incentive_audit_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert incentive audit uploads"
  ON public.incentive_audit_uploads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Admin can delete incentive audit uploads"
  ON public.incentive_audit_uploads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can read incentive audit rows"
  ON public.incentive_audit_rows
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert incentive audit rows"
  ON public.incentive_audit_rows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
  );

CREATE POLICY "Admin can delete incentive audit rows"
  ON public.incentive_audit_rows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_active = true AND u.role = 'admin'
    )
  );

GRANT SELECT, INSERT, DELETE ON public.incentive_audit_uploads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.incentive_audit_rows TO authenticated;

COMMENT ON TABLE public.incentive_audit_uploads IS
  'Uploaded INCENTIVES VERIFICATION Excel files for recruiter incentive audit.';
COMMENT ON TABLE public.incentive_audit_rows IS
  'Parsed candidate rows with duplicate / already-received flags.';
