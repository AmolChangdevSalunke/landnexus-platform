# LandNexus - Project Status

Last updated: 2026-11-02

## Environment (verified)
- Windows, Java 21, Maven Wrapper (mvnw.cmd), Spring Boot 4.1.2
- PostgreSQL 18.6 + PostGIS 3.6, database `landnexus_dev` (old database `landnexus` untouched)
- Secrets come from environment variables: DB_PASSWORD, JWT_SECRET, LANDNEXUS_ADMIN_USERNAME / LANDNEXUS_ADMIN_PASSWORD

## Done and verified
- Foundation: app starts, /actuator/health UP, Flyway V1 (enable postgis)
- Shared: ApiError, exception handler (400/401/403/404/405/409 safe), pagination helpers
- Administration slice 1: Ministry, Department, State, Division, District, Taluka, Village (Flyway V2)
- Administration slice 2a: JWT login/refresh/logout/me, users, roles, permissions, 13 roles (Flyway V3),
  backend permission checks, BCrypt, lockout, refresh-token rotation and reuse detection, bootstrap SUPER_ADMIN
- Administration slice 2b: append-only audit trail, login history, automatic created_by/updated_by,
  geographic scope (State/Division/District) with GeoScopeService, AUDIT_READ permission (Flyway V4)
- Verification (2026-11-02): `mvnw clean verify` BUILD SUCCESS, 181 tests, 0 failures;
  smoke tests for slices 1, 2a, 2b all PASS; database refuses DELETE on audit_events

## Pending
- Module 2: Government Projects and Consultant Proposal workflow (next)
- Repository tests on a dedicated test database; production-grade rate limiting
- Modules 3-7, frontend integration, Docker (later)

## Known risks / limits
- Access token stays valid up to 15 minutes after a user is disabled
- Geographic scope is enforced only on my-districts so far; proposals/parcels must call GeoScopeService
- IP addresses in login history are personal data: restrict AUDIT_READ, define retention
- show-sql is on (development); weak local DB password: change before any demo
- Nothing has been pushed to GitHub (local commits only)

## Next exact task
Confirm the Module 2 plan (proposals + workflow engine), then build slice 3a.