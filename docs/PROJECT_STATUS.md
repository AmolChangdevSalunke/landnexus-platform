# LandNexus - Project Status

Last updated: 2026-11-01

## Environment (verified)
- Windows, Java 21, Maven Wrapper (mvnw.cmd), Spring Boot 4.1.2
- PostgreSQL 18.6 + PostGIS 3.6, database `landnexus_dev` (old database `landnexus` untouched)
- DB password comes from environment variable DB_PASSWORD

## Done and verified
- Foundation: app starts, /actuator/health UP, Flyway V1 (enable postgis)
- Shared: ApiError, exception handler (400/404/409/405 safe), pagination helpers
- Administration slice 1: Ministry, Department, State, Division, District, Taluka, Village (Flyway V2)
- Verification: `mvnw clean verify` BUILD SUCCESS, 88 tests; smoke test 13/13 PASS

## Pending
- Administration slice 2: Users, Roles, Permissions, JWT, refresh tokens, geographic access control, login history, audit events
- Repository tests on real PostgreSQL; authorization tests
- Modules 2-7, frontend integration, Docker (later)

## Known risks
- Administration endpoints have NO authentication yet (local use only)
- Old dashboard code is still staged in the Git index (not yet cleaned)

## Next exact task
Back up the Git index, then start Administration slice 2 (Users/Roles/JWT).