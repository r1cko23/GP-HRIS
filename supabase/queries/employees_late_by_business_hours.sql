-- =====================================================
-- Employees who are LATE based on their business hours
-- =====================================================
-- Run in Supabase Dashboard → SQL Editor.
-- Office-based only. Schedule from employee_week_schedules or default 08:00 (09:00 for Michelle Razal, Jon Alfeche).
-- Late = clock_in (Asia/Manila time) after scheduled start_time.
-- Change the date range in the first CTE if needed.
-- =====================================================

WITH date_range AS (
  SELECT (CURRENT_DATE - INTERVAL '7 days')::date AS from_date, CURRENT_DATE AS to_date
),
-- All clock-ins in range with local date/time
entries AS (
  SELECT
    t.employee_id,
    t.id AS entry_id,
    t.clock_in_time,
    ((t.clock_in_time AT TIME ZONE 'Asia/Manila')::date) AS work_date,
    ((t.clock_in_time AT TIME ZONE 'Asia/Manila')::time) AS clock_in_time_local
  FROM time_clock_entries t
  CROSS JOIN date_range dr
  WHERE ((t.clock_in_time AT TIME ZONE 'Asia/Manila')::date) BETWEEN dr.from_date AND dr.to_date
),
-- Scheduled start: from employee_week_schedules or default (Mon-Sat 08:00; 09:00 for Michelle Razal, Jon Alfeche). Sunday = no default.
schedules AS (
  SELECT
    e.employee_id,
    e.work_date,
    e.clock_in_time_local,
    COALESCE(
      ews.start_time,
      CASE
        WHEN EXTRACT(DOW FROM e.work_date) = 0 THEN NULL  -- Sunday: no default, skip
        WHEN LOWER(TRIM(emp.full_name)) IN ('michelle razal', 'jon alfeche') THEN '09:00'::time
        ELSE '08:00'::time
      END
    ) AS scheduled_start
  FROM entries e
  JOIN employees emp ON emp.id = e.employee_id
  LEFT JOIN employee_week_schedules ews
    ON ews.employee_id = e.employee_id
   AND ews.schedule_date = e.work_date
   AND (ews.day_off IS NOT TRUE)
   AND ews.start_time IS NOT NULL
  WHERE emp.employee_type = 'office-based'
    AND emp.is_active = true
),
-- Only rows where we have a schedule and clock-in is after scheduled start (late)
late_rows AS (
  SELECT
    employee_id,
    work_date,
    scheduled_start,
    clock_in_time_local AS actual_clock_in,
    EXTRACT(EPOCH FROM (clock_in_time_local - scheduled_start)) / 60 AS late_minutes
  FROM schedules
  WHERE scheduled_start IS NOT NULL AND clock_in_time_local > scheduled_start
)
SELECT
  emp.employee_id,
  emp.full_name,
  l.work_date,
  l.scheduled_start,
  l.actual_clock_in,
  ROUND(l.late_minutes)::int AS late_minutes
FROM late_rows l
JOIN employees emp ON emp.id = l.employee_id
ORDER BY l.work_date DESC, l.late_minutes DESC;
