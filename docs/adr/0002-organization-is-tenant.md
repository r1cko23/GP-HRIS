# Organization is the tenant; Client is a view

GREENHRISMAIN looks multi-tenant because each hotel has its own roster, but isolation is **Organization** (`organization_id` on every Directory row). **Client** is the working set you filter to (`client_id`), not a second Supabase project and not a login tenant by itself. Attendance binds a session to one `directory_client_id`; GP-HR Admin/HR picks a Client and calls `/api/directory/employees?client_id=`. Site-supervisor logins, if needed later, are Client-bound memberships on top of this — they do not split the database.
