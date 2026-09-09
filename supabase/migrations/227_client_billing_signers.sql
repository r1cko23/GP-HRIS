-- MAIN client.billingpreparedby / billingnotedby → SOA Header signers.

ALTER TABLE directory.clients
  ADD COLUMN IF NOT EXISTS billing_prepared_by TEXT,
  ADD COLUMN IF NOT EXISTS billing_prepared_by_role TEXT,
  ADD COLUMN IF NOT EXISTS billing_noted_by TEXT,
  ADD COLUMN IF NOT EXISTS billing_noted_by_role TEXT;

COMMENT ON COLUMN directory.clients.billing_prepared_by IS
  'SOA Header PreparedByName (MAIN client.billingpreparedby).';
COMMENT ON COLUMN directory.clients.billing_prepared_by_role IS
  'SOA Header PreparedByDesignation (MAIN client.billingpreparedbyrole).';
COMMENT ON COLUMN directory.clients.billing_noted_by IS
  'SOA Header NotedByName (MAIN client.billingnotedby).';
COMMENT ON COLUMN directory.clients.billing_noted_by_role IS
  'SOA Header NotedByDesignation (MAIN client.billingnotedbyrole).';

NOTIFY pgrst, 'reload schema';
