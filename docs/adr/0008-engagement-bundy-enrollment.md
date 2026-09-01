# Engagement module + Bundy enrollment + hybrid Organization gate

Directory person transitions live behind an **Engagement** module; Clock rows are created only via **Bundy enrollment**. Organization access is hybrid: Admin any org, HR-family via `organization_members`, service key with `x-organization-id`. Client.`bundy_enabled` drives best-effort auto-enroll after hire/rehire (Engagement always commits). Identity is Directory-first — `POST /api/employees/create` is enroll-only.

## Status

Accepted — 2026-09-01.

## Consequences

- Office `/time/enrollment/new` enrolls from Directory; new people are hired in People.
- Force rehire is Admin-only.
- Deployed mass bundy remains forbidden (ADR 0005); flip `bundy_enabled` per Client for testing.
