# Service credentials are contextual and capability-scoped

## Status

Accepted — 2026-10-07. Defines the target replacement for shared all-purpose service API keys; user ABAC remains unchanged.

## Context

Sibling calls currently use a shared `x-directory-api-key` plus caller-supplied `x-organization-id`. A leaked key can be replayed broadly, the asserted tenant is not cryptographically bound to the caller, rotation can interrupt every integration at once, and audit logs cannot reliably distinguish services or capabilities.

The apps still need machine-to-machine access, independent deployment, and emergency recovery. This decision does not unify user login or replace Pages + Functions grants inside each app.

## Decision

1. Machine calls use short-lived signed credentials with these verified claims:
   - `iss`, `sub`, `aud`, `jti`, `iat`, `nbf`, and `exp`;
   - `environment`;
   - allowed `organization_ids`;
   - allowed `client_ids` or an explicit organization-wide scope;
   - named `capabilities`, such as `directory.person.read`, `csm.placement.command`, `time.approved-work.publish`, or `payroll.approved-work.accept`;
   - credential/key version.
2. The receiving app validates signature, issuer, audience, environment, expiry, revocation, organization/client context, and capability before domain authorization.
3. Organization and Client IDs in a request must be within the credential claims. A header or body cannot widen credential scope.
4. Tokens live for minutes, not months. Workload identity or a separately protected rotating client credential obtains them. Signing keys rotate with overlap and key IDs.
5. Each app and environment has a distinct service identity. Production credentials cannot call staging, and one sibling's credential cannot impersonate another.
6. Logs record service subject, token ID, capability, scoped Organization/Client, decision, correlation ID, and endpoint. Logs never record the token or signing secret.
7. Revocation and a time-boxed, audited break-glass credential are required. Break-glass scope is limited to the affected capability and Client wherever possible.
8. During migration, endpoints may accept both the existing key and contextual credentials behind capability flags. The old key is read from the server environment only, emits deprecation telemetry, and is revoked after the roadmap exit gate.
9. Browser users continue to use session identity plus ABAC Pages, Functions, and row attributes. A service credential never grants a human UI role.

## Consequences

- Compromise impact is limited by app, environment, tenant, Client, capability, and expiry.
- Audit records can identify the calling workload and authorized purpose.
- Token issuance, key distribution, clock synchronization, rotation, revocation, and availability become platform responsibilities.
- Calls may fail closed during identity infrastructure outages; bounded break-glass procedures and queued outbox delivery reduce pressure to broaden access.
- Every API must declare its required capability and derive tenant context from verified claims before accepting caller-provided IDs.
- The shared `x-directory-api-key` remains only a temporary migration compatibility mechanism.
