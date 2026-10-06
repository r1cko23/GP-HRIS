-- SUPERSEDED by 272_drop_employee_sea_ctpa.sql.
-- Position cards carry SEA / CTPA. MAIN never stored them on Employee —
-- only ECOLA. This migration briefly added person columns to paper over
-- hire/rehire copying card rates onto the 201; that copy path was wrong.

ALTER TABLE directory.employees
  ADD COLUMN IF NOT EXISTS sea NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS ctpa NUMERIC(12, 4);

COMMENT ON COLUMN directory.employees.sea IS
  'Subsistence / SEA allowance per day copied from the assigned position card.';
COMMENT ON COLUMN directory.employees.ctpa IS
  'CTPA allowance per day copied from the assigned position card.';
