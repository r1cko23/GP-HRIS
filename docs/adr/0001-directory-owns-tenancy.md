# Directory owns tenancy

GREENHRISMAIN kept organization, client, branch, position, and employee in one SQL Server database. Directory lives in the **same GP-HRIS Supabase project** (Pro) as schema `directory`, so clock-in, leave, and OT on `public.employees` keep working. `public.employees` may store `directory_employee_id` / `directory_client_id`; it is not replaced by the 29k GREENHRISMAIN roster. Sibling apps call `/api/directory/*` on GP-HRIS.
