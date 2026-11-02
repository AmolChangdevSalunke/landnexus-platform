# Audit Trail, Login History and Geographic Scope - Slice 2b

Status: implemented and verified on 2026-11-02 (181 tests, smoke test all PASS, DELETE on audit_events refused by the database).

## Audit trail (`audit_events`)
- Every create / update / activate / deactivate of master data, and every user change (create, roles, enable/disable, scope replacement), writes one row **in the same transaction** as the change.
- Security events: account lockout, refresh-token reuse, bootstrap administrator creation.
- Fields: time, actor (id and username), action, entity type, entity id, details (readable before/after text; never passwords or tokens).
- **Append-only**: a database trigger rejects UPDATE and DELETE. A database superuser could still drop the trigger, so this is tamper-resistant, not tamper-proof; a hash chain or external log shipping would be the next level.
- Read with `GET /api/v1/administration/audit-events?entityType=&entityId=&actor=&page=&size=` (newest first). Needs `AUDIT_READ`. `entityId` requires `entityType`.

## Login history (`login_history`)
- One row per login attempt: username tried, success flag, internal failure reason (`UNKNOWN_USER`, `BAD_PASSWORD`, `ACCOUNT_DISABLED`, `ACCOUNT_LOCKED`), IP address, user agent.
- The caller never sees the reason; the API answer stays "Invalid username or password".
- Append-only like the audit trail. Read with `GET /api/v1/administration/login-history?username=`. Needs `AUDIT_READ`.
- IP addresses are personal data: restrict `AUDIT_READ` and define a retention period before any real deployment. The IP is the direct connection address (behind a reverse proxy it would be the proxy; configure forwarded headers only when a trusted proxy is added).

## created_by / updated_by
Master-data rows now record the logged-in username automatically (Spring Data JPA auditing). Rows created before this slice keep empty values.

## Geographic scope
- A user can be assigned any number of scopes; each is exactly one **State**, **Division** or **District** (checked by a database constraint).
- Nationwide roles (`SUPER_ADMIN`, `CENTRAL_ADMIN`, `MINISTRY_ADMIN`, `AUDITOR`) need no assignment.
- Every other role sees **only** what is assigned; with no assignment they see nothing (deny by default). Assignments are read from the database on each request, so a change applies immediately.
- `PUT /api/v1/administration/users/{id}/scopes` replaces the whole list (empty list clears it); `GET` lists it. `GET /api/v1/administration/my-districts` returns the districts the caller may use (for drop-downs).
- **Where it is enforced today:** `my-districts`. The reusable rule is `GeoScopeService.requireDistrictAccess(actor, districtId)`; proposals, parcels and surveys (next modules) must call it before returning or changing district-bound data. Geography reference data itself (states, districts, villages) stays readable by every internal role.

## New permission
`AUDIT_READ` (SUPER_ADMIN, CENTRAL_ADMIN, AUDITOR).

## Tests added
Unit: AuditService (actor from token, system, truncation), AuditQueryService, GeoScopeService (nationwide, state/division/district grants, deny by default, validation, dedupe, audit), updated AuthService/UserService/BootstrapAdminService/master-data services. Integration (real database): audit written and stamped, audit table refuses UPDATE/DELETE, permission checks, login history rows, scope limits `my-districts`.
