-- Manual Debit Memo Queue enrollment: posted runs are not listed until status=queued.
-- upload_date / batch_no are set later when the BDO .txt is generated.

ALTER TABLE public.payroll_bdo_disbursements
  ALTER COLUMN upload_date DROP NOT NULL;

ALTER TABLE public.payroll_bdo_disbursements
  ALTER COLUMN batch_no DROP NOT NULL;

ALTER TABLE public.payroll_bdo_disbursements
  DROP CONSTRAINT IF EXISTS payroll_bdo_disbursements_batch_no_check;

ALTER TABLE public.payroll_bdo_disbursements
  ADD CONSTRAINT payroll_bdo_disbursements_batch_no_check
  CHECK (batch_no IS NULL OR (batch_no BETWEEN 1 AND 99));

ALTER TABLE public.payroll_bdo_disbursements
  DROP CONSTRAINT IF EXISTS payroll_bdo_disbursements_status_check;

ALTER TABLE public.payroll_bdo_disbursements
  ADD CONSTRAINT payroll_bdo_disbursements_status_check
  CHECK (status IN ('queued', 'awaiting_ref', 'confirmed', 'void'));

ALTER TABLE public.payroll_bdo_disbursements
  ALTER COLUMN status SET DEFAULT 'queued';

ALTER TABLE public.payroll_bdo_disbursements
  ALTER COLUMN generated_at DROP NOT NULL;

ALTER TABLE public.payroll_bdo_disbursements
  DROP CONSTRAINT IF EXISTS payroll_bdo_disbursements_file_when_awaiting;

ALTER TABLE public.payroll_bdo_disbursements
  ADD CONSTRAINT payroll_bdo_disbursements_file_when_awaiting CHECK (
    (
      status = 'queued'
      AND file_body IS NULL
      AND upload_date IS NULL
      AND batch_no IS NULL
    )
    OR (
      status IN ('awaiting_ref', 'confirmed')
      AND file_body IS NOT NULL
      AND upload_date IS NOT NULL
      AND batch_no IS NOT NULL
    )
    OR status = 'void'
  );

DROP INDEX IF EXISTS payroll_bdo_disbursements_batch_uidx;
CREATE UNIQUE INDEX payroll_bdo_disbursements_batch_uidx
  ON public.payroll_bdo_disbursements (organization_id, upload_date, batch_no)
  WHERE status <> 'void' AND upload_date IS NOT NULL AND batch_no IS NOT NULL;

COMMENT ON TABLE public.payroll_bdo_disbursements IS
  'Debit Memo Queue: manually enqueued posted runs (queued → awaiting_ref → confirmed). Not every posted register appears here.';
