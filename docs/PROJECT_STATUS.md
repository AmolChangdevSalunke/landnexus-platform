# LandNexus - Project Status

Last updated: 2026-11-05

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

## Frontend
- F0/F1 complete: authentication, session restore, permissions, app shell, UI kit, tests
- F2 complete and verified (2026-11-05): proposals list, create/edit form with
  district -> taluka -> villages, details, backend-driven action bar, history, versions,
  status timeline, filters, pagination and error states
- F3 complete and verified (2026-11-05): read-only government project register with district
  filter, project details with affected villages and originating-proposal link, paged
  notifications with unread-only filter and mark-as-read, latest five in the header
  dropdown, and unread badge refresh after workflow actions
  - `npm run build` PASS (strict `tsc -b` + Vite, 1814 modules)
  - `npm run test` PASS (14 files, 64 tests, Vitest + RTL + MSW)
  - Uses real backend endpoints (`/projects`, `/notifications`) only; no demo records or
    invented counts
- F4 complete and verified (2026-11-05): administration against the real backend
  - Generic master-data screens for ministries, departments, states, divisions,
    districts, talukas and villages: paged lists, parent filters (`ministryId`,
    `stateId`, `districtId`, `talukaId`), create/edit, and activate/deactivate
    (no delete), with writes only for `MASTER_DATA_WRITE`
  - Users: paged list, create with server-matching password rules, full role
    replacement, enable/disable with confirmation, and geographic-scope editing
    (State/Division/District) that replaces the whole list
  - Roles: read-only catalogue and permission matrix (`GET /administration/roles`
    only; no edit endpoint exists)
  - Audit trail: newest-first paged events with entity-type, entity-id and actor
    filters and expandable details; strictly read-only
  - Login history: newest-first paged attempts with username filter, success and
    failure badges, failure reason, IP and user agent; strictly read-only
  - SUPER_ADMIN protections mirror the backend: only a super administrator may
    grant `SUPER_ADMIN` or change a `SUPER_ADMIN` account; self-disable is blocked
  - Candidate scope lists need `MASTER_DATA_READ`; without it users can still
    remove existing assignments and save
  - `npm run build` PASS (strict `tsc -b` + Vite, 1825 modules)
  - `npm run test` PASS (19 files, 78 tests, Vitest + RTL + MSW)
  - Uses real backend endpoints under `/administration` only; no demo records or
    invented counts
- Next: F5 after user confirmation

## Project plan addition
- Section 8.14 "Permission-Based Geographic Map" is approved as a concept for a later
  GIS phase only. See `docs/PROJECT_PLAN.md`. No GIS screen, geometry API or migration is
  part of F2/F3, and this concept must not interrupt the phase order.

## Pending
- Module 2 backend verification on the project machine (`mvnw clean verify` and the
  workflow demo script) before calling the backend verified
- Repository tests on a dedicated test database; production-grade rate limiting
- Modules 3-7, frontend F5, Docker (later)

## Known risks / limits
- Access token stays valid up to 15 minutes after a user is disabled
- Geographic scope is enforced only on my-districts so far; proposals/parcels must call GeoScopeService
- IP addresses in login history are personal data: restrict AUDIT_READ, define retention
- show-sql is on (development); weak local DB password: change before any demo
- Nothing has been pushed to GitHub (local commits only)

## Next exact task
Wait for user confirmation, then build frontend F5. Do not start F5 or GIS work
before that confirmation.