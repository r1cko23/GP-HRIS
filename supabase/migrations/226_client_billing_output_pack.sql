-- Per-Client SOA / debit-memo pack (ADR 0015, CLIENT_BILLING_SOA.md).
-- Switching pack does not change stored billing amounts.

ALTER TABLE directory.clients
  ADD COLUMN IF NOT EXISTS billing_output_pack TEXT NOT NULL DEFAULT 'generic';

ALTER TABLE directory.clients
  DROP CONSTRAINT IF EXISTS clients_billing_output_pack_check;

ALTER TABLE directory.clients
  ADD CONSTRAINT clients_billing_output_pack_check
  CHECK (billing_output_pack IN ('generic', 'aldex', 'plk', 'debit_memo'));

COMMENT ON COLUMN directory.clients.billing_output_pack IS
  'SOA workbook pack after Process billing: generic | aldex | plk | debit_memo. Default generic.';

NOTIFY pgrst, 'reload schema';
