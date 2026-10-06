-- Standing timesheet size for a Directory Site (payroll branch).
-- 0 daily, 7 weekly, 10–13 workday caps. Null means HR has not set it;
-- a cutoff cannot open for that site until it is set.

ALTER TABLE directory.client_branches
  ADD COLUMN IF NOT EXISTS timesheet_pay_format SMALLINT;

ALTER TABLE directory.client_branches
  DROP CONSTRAINT IF EXISTS client_branches_timesheet_pay_format_check;

ALTER TABLE directory.client_branches
  ADD CONSTRAINT client_branches_timesheet_pay_format_check
  CHECK (
    timesheet_pay_format IS NULL
    OR timesheet_pay_format IN (0, 7, 10, 11, 12, 13)
  );

COMMENT ON COLUMN directory.client_branches.timesheet_pay_format IS
  'Timesheet size copied onto each cutoff: 0 daily, 7 weekly (56 hours), or 10/11/12/13 workdays. Null blocks Open timekeeping.';
