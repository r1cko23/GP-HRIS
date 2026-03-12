-- One-off: remove all linked login devices for employee 2025001 (Jericko Razal)
-- so they can run the multi-device Playwright test without hitting "Too many devices".
DELETE FROM public.employee_login_devices
WHERE employee_id = (SELECT id FROM public.employees WHERE employee_id = '2025001');
