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
- Administration slice 2a: JWT login/refresh/logout/me, users, roles, permissions, 13 roles seeded (Flyway V3),
  backend permission checks (@PreAuthorize), BCrypt, lockout, refresh-token rotation and reuse detection,
  bootstrap SUPER_ADMIN from environment variables
- Verification (2026-11-02): `mvnw clean verify` BUILD SUCCESS, 149 tests, 0 failures;
  auth smoke test 17/17 PASS; master-data smoke test 13/13 PASS

## Pending
- Administration slice 2b: geographic access control, login history, audit events, fill created_by/updated_by on master data
- Repository tests on a dedicated test database; production-grade rate limiting
- Modules 2-7 (Projects first), frontend integration, Docker (later)

## Known risks / limits
- Access token stays valid up to 15 minutes after a user is disabled
- show-sql is on (development); move to a dev-only profile
- Weak local DB password: change before any demo
- Nothing has been pushed to GitHub (local commits only)

## Next exact task
Decide: Administration slice 2b (recommended) or start Module 2 (Government Projects).