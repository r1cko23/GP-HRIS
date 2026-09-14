-- Employee 201 document vault (government IDs, clearances). Private bucket.
-- Scans attach to the Directory person, not a Client or cutoff.

CREATE TABLE IF NOT EXISTS directory.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES directory.organizations (id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES directory.employees (id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL
    CHECK (
      doc_type IN (
        'sss_id',
        'tin_id',
        'philhealth_id',
        'pagibig_id',
        'nbi_clearance',
        'police_clearance',
        'barangay_clearance',
        'psa_birth',
        'government_id',
        'medical_clearance',
        'employment_contract',
        'other'
      )
    ),
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  id_number_on_doc TEXT,
  expires_on DATE,
  notes TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE directory.employee_documents IS
  'Scanned 201 attachments. One current file per employee + doc_type; prior rows keep superseded_at.';

CREATE UNIQUE INDEX IF NOT EXISTS employee_documents_one_current_idx
  ON directory.employee_documents (employee_id, doc_type)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_documents_employee_idx
  ON directory.employee_documents (organization_id, employee_id, uploaded_at DESC);

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS has_statutory_scan BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN directory.employees.has_statutory_scan IS
  'True when a current SSS/TIN/PhilHealth/Pag-IBIG scan exists on employee_documents.';

CREATE INDEX IF NOT EXISTS employees_missing_statutory_scan_idx
  ON directory.employees (organization_id)
  WHERE is_current_engagement AND NOT has_statutory_scan;

CREATE OR REPLACE FUNCTION directory.sync_has_statutory_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee uuid;
BEGIN
  v_employee := COALESCE(NEW.employee_id, OLD.employee_id);
  UPDATE directory.employees e
  SET has_statutory_scan = EXISTS (
    SELECT 1
    FROM directory.employee_documents d
    WHERE d.employee_id = v_employee
      AND d.superseded_at IS NULL
      AND d.doc_type IN ('sss_id', 'tin_id', 'philhealth_id', 'pagibig_id')
  )
  WHERE e.id = v_employee;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS employee_documents_sync_scan ON directory.employee_documents;
CREATE TRIGGER employee_documents_sync_scan
AFTER INSERT OR UPDATE OR DELETE ON directory.employee_documents
FOR EACH ROW
EXECUTE FUNCTION directory.sync_has_statutory_scan();

ALTER TABLE directory.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_documents_all ON directory.employee_documents;
CREATE POLICY employee_documents_all ON directory.employee_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON directory.employee_documents TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Service role only. Runtime uploads go through /api/directory/employees/:id/documents.
DROP POLICY IF EXISTS employee_documents_storage_service ON storage.objects;
CREATE POLICY employee_documents_storage_service
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'employee-documents')
WITH CHECK (bucket_id = 'employee-documents');

INSERT INTO public.hris_capabilities (key, kind, label, description, sort_order)
VALUES (
  'fn:employees.documents',
  'function',
  'Upload employee documents',
  'Government ID scans on the 201 file',
  215
)
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.hris_user_grants (user_id, capability_key)
SELECT g.user_id, 'fn:employees.documents'
FROM public.hris_user_grants g
WHERE g.capability_key = 'fn:employees.update'
ON CONFLICT (user_id, capability_key) DO NOTHING;

CREATE OR REPLACE FUNCTION directory.employee_work_counts(p_org uuid)
RETURNS TABLE (
  needs_review bigint,
  missing_statutory bigint,
  missing_documents bigint,
  incomplete_201 bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH latest AS (
    SELECT
      e.client_id,
      MAX(e.last_payroll_end) FILTER (
        WHERE e.last_payroll_end IS NOT NULL AND e.last_payroll_end >= '2000-01-01'
      ) AS latest_payroll_end
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
    GROUP BY e.client_id
  ),
  current_people AS (
    SELECT e.*
    FROM directory.employees e
    WHERE e.organization_id = p_org
      AND e.is_current_engagement = true
  )
  SELECT
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      LEFT JOIN latest l ON l.client_id = e.client_id
      WHERE e.status = 'active'
        AND (
          e.last_payroll_end IS NULL
          OR (l.latest_payroll_end IS NOT NULL AND e.last_payroll_end < l.latest_payroll_end)
        )
    ) AS needs_review,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE COALESCE(NULLIF(BTRIM(e.tin), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sss_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.philhealth_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.pagibig_number), ''), NULL) IS NULL
    ) AS missing_statutory,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE e.has_statutory_scan = false
    ) AS missing_documents,
    (
      SELECT COUNT(*)::bigint
      FROM current_people e
      WHERE e.birth_date IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sex), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.mobile), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.tin), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.sss_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.philhealth_number), ''), NULL) IS NULL
         OR COALESCE(NULLIF(BTRIM(e.pagibig_number), ''), NULL) IS NULL
         OR e.position_id IS NULL
         OR e.daily_rate IS NULL
         OR (
           COALESCE(NULLIF(BTRIM(e.bank_account_no), ''), NULL) IS NULL
           AND COALESCE(NULLIF(BTRIM(e.gcash), ''), NULL) IS NULL
         )
    ) AS incomplete_201;
$$;

GRANT EXECUTE ON FUNCTION directory.employee_work_counts(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
