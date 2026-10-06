-- MAIN never stored SEA/CTPA on the Employee master — only ECOLA.
-- Position cards hold positionsea / positionctpa; payroll lines compute
-- seaperday / ctpaperday for the cutoff. Migration 271 added person columns
-- to paper over hire/rehire copying card rates onto the 201; reverse that.

ALTER TABLE directory.employees
  DROP COLUMN IF EXISTS sea,
  DROP COLUMN IF EXISTS ctpa;
