# Testing and Verification Record

**Last updated:** 16 November 2026  
**Rule:** this file records commands that were actually run and their actual output. A test is not “passing” because it exists.

---

## 1. Environment

| Item | Value |
|---|---|
| Backend working directory | `D:\landnexus-platform\landnexus-backend` |
| Frontend working directory | `D:\landnexus-platform\LandNexus-frontend` |
| Backend stack | Java 21, Spring Boot 4.1.2, Hibernate 7.4.13, PostgreSQL driver 42.7.14 |
| Database | PostgreSQL 18.6 + PostGIS 3.6.2, disposable database `landnexus_nlams_test_20261115` |
| Frontend stack | React 18.3, TypeScript 5.6, Vite 6, Vitest 4 |
| OS | Windows (`win32`), PowerShell |

Database-backed tests were run with:

```powershell
$env:LANDNEXUS_TEST_DB_URL='jdbc:postgresql://localhost:5432/landnexus_nlams_test_20261115'
$env:LANDNEXUS_TEST_DB_USERNAME='postgres'
$env:LANDNEXUS_TEST_DB_PASSWORD='<locally configured password; do not commit>'
```

The isolated-test base rejects `landnexus_dev`. An initial full-suite run exposed one
`@SpringBootTest` class that did not inherit that base and applied additive V23 report views
to `landnexus_dev`. That class was fixed before the successful full-suite rerun; the final
suite used only the disposable database. V23 did not modify data rows.

---

## 2. Full backend suite — PASS

**Command**

```powershell
cd D:\landnexus-platform\landnexus-backend
$env:LANDNEXUS_TEST_DB_URL='jdbc:postgresql://localhost:5432/landnexus_nlams_test_20261115'
$env:LANDNEXUS_TEST_DB_USERNAME='postgres'
$env:LANDNEXUS_TEST_DB_PASSWORD='<locally configured password; do not commit>'
.\mvnw.cmd test
```

**Actual result**

| Metric | Value |
|---|---|
| Exit code | `0` |
| Tests run | **579** |
| Failures | **0** |
| Errors | **0** |
| Skipped | **0** |
| Flyway | Validated/applied migrations through **V25** on `landnexus_nlams_test_20261115` |

The latest totals were aggregated from the full Maven test run after V24/V25 permission changes and dashboard analytics changes. All Spring integration contexts used the disposable database after a test class was fixed to inherit the isolated database guard.

Baseline before Phase 1 fixes: 542 tests with 14 failures and 3 errors in the targeted run. The final suite is larger because new project-management and document-preview tests were added.

### Focused backend checks

| Command | Result |
|---|---|
| `.\mvnw.cmd -q -Dtest=DocumentServiceTest test` | 17 tests, 0 failures, 0 errors |
| Targeted proposal workflow/reliability/rollback/password classes | 18 tests passed before the full run |

---

## 3. Full frontend suite — PASS

**Command**

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm test
```

**Actual result**

| Metric | Value |
|---|---|
| Exit code | `0` |
| Test files | **50 passed (50)** |
| Tests | **250 passed (250)** |
| Duration | Full suite completed successfully |

The first full run, before the final TypeScript narrowing fix, also reported 47 files / 240 tests passed. The production build then caught a null-safety error in `ProjectDetailsPage.tsx`; after the fix, the focused project-details test passed (3 tests) and the full suite was re-run.

### Focused frontend checks

| Command | Result |
|---|---|
| `npm test -- --run src/features/landRecords/DocumentDetailsPage.test.tsx src/features/landRecords/DocumentsTab.test.tsx` | 2 files, 8 tests passed |
| `npm test -- --run src/features/projects/ProjectDetailsPage.test.tsx` | 1 file, 3 tests passed |

New or extended tests cover:

- inline document preview and object-URL revocation;
- project edit/close/reopen and permission-aware controls;
- forgot-password validation, request and success states;
- proposal routing/reliability fixtures and assignment sequencing.

---

## 4. Frontend production build — PASS

**Command**

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm run build
```

**Actual result**

| Metric | Value |
|---|---|
| `tsc -b` | passed, no diagnostics |
| Vite | `✓ 2546 modules transformed` |
| Build | Production bundle completed successfully |
| Warning | Main `index` chunk is 1,164.76 kB (above Vite’s 500 kB advisory threshold) |

The chunk-size warning is a performance note, not a build failure. Code splitting is a later optimisation, not a Phase 1 blocker.

The build initially failed with:

```
src/features/projects/ProjectDetailsPage.tsx(174,49): error TS18047: 'project' is possibly 'null'.
src/features/projects/ProjectDetailsPage.tsx(174,77): error TS18047: 'project' is possibly 'null'.
```

The handler now captures `projectId` after the null guard. The rebuild passed.

---

## 5. Database verification

| Check | Result |
|---|---|
| Migrations added in the overall continuation | `V23__report_filter_dimensions.sql`, `V24__user_permission_overrides.sql`, `V25__authorization_version.sql` |
| Applied migrations modified | None |
| Destructive commands run | None |
| Main test suite database | `landnexus_nlams_test_20261115` (disposable) |
| Flyway result | Schema validated/applied through V25 |
| Unintended earlier migration | An initial run applied additive V23 views to `landnexus_dev` because one Spring test class did not inherit the isolation guard; this class was fixed before the successful full rerun. No row data was modified by V23. |
| Demo script | `scripts/full-demo.ps1` passed twice; 193 checks passed and 0 failed on each run |
| Measured rows | users 13; proposals 4; projects 2; acquisition cases 2; parcels 6; compensation payments 4; R&R cases 2 |
| Integrity checks | 6 current parcel boundaries valid; selected project/acquisition/payment/R&R orphan counts 0 |
| Analytics cross-check | Dashboard proposal/project/acquisition/pending-task aggregates with project/taluka/date filters matched direct SQL in PostgreSQL integration tests; baseline proposals/projects/active parcels/acquisition cases were 4/4, 2/2, 6/6, 2/2; filtered report count 1/1 |
| Scheduled SLA | One scheduler WARNING and one BREACH persisted; repeated scans left scheduler-triggered escalation count at 2; original SLA rule was restored |

`psql` is not on `PATH` in this environment, so no separate ad-hoc shell query was run. Direct SQL comparisons were executed within PostgreSQL integration tests, not inferred from inspecting SQL parameters.

---

## 6. What was not run

| Not run | Why |
|---|---|
| `.\mvnw.cmd clean verify` | Not required for Phase 1 acceptance; `test` was run against a disposable database. |
| Docker/Testcontainers concurrency run | Docker is not available in this environment. |
| Real e-mail/SMS provider delivery | No provider credentials; default is `none`. |
| Government integration tests | No integration is implemented; see `docs/GOVERNMENT_INTEGRATION_STATUS.md`. |
| Multilevel/named-officer SLA targets, unavailable-target cases and on-time scheduler case | Not implemented or not exercised; see acceptance report. |
| Full GIS conflict/upload scenario, PFMS/DBT rail breakdown and every analytics dimension | Not exercised or not supported by schema; SQL comparisons were limited to the filtered aggregates listed above. |

Do not describe any of these as passing until they are actually run and recorded here.

## 9. Dashboard analytics continuation — 16 Nov 2026

| Command/check | Actual result |
|---|---|
| `.\mvnw.cmd -q -DskipTests compile` | Exit 0 after V26/payment-channel and role-token invalidation changes |
| `.\mvnw.cmd -q -Dtest=DashboardServiceTest,RoleServiceTest test` | Exit 0; focused unit tests passed. No PostgreSQL integration tests were run by this command. |
| `npm test -- --run` | **50 files / 250 tests passed** before the new role-history UI test |
| `npm test -- --run src/features/admin/users/RolesPage.test.tsx` | **1 file / 3 tests passed** after adding role-permission history |
| `npm run build` | Exit 0 after role-history UI changes; `tsc -b` and Vite production build passed, with the existing large-chunk advisory |
| Isolated DB configuration | **Unavailable** — all of `LANDNEXUS_TEST_DB_URL`, `LANDNEXUS_TEST_DB_USERNAME`, and `LANDNEXUS_TEST_DB_PASSWORD` were unset |
| Flyway V26 / dashboard SQL comparison / seed / full backend suite after V26 | **Not run**; do not infer database verification from compilation or unit/frontend tests |

---

## 7. Reproducing the verification

```powershell
# Backend
cd D:\landnexus-platform\landnexus-backend
$env:LANDNEXUS_TEST_DB_URL='jdbc:postgresql://localhost:5432/<new-disposable-database>'
$env:LANDNEXUS_TEST_DB_USERNAME='postgres'
$env:LANDNEXUS_TEST_DB_PASSWORD='<password>'
.\mvnw.cmd test

# Frontend
cd D:\landnexus-platform\LandNexus-frontend
npm test
npm run build
```

Use a NEW disposable database. Never point the guards at a shared or developer database, and do not include passwords in scripts or documentation.

## 8. Authorization update — V24/V25

The following focused permission tests were first run after the permission override and authorization-version changes using the same disposable database; Flyway applied through V25:

| Test suite | Tests | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| `UserServiceTest` | 18 | 0 | 0 | 0 |
| `UserPermissionIntegrationTest` | 3 | 0 | 0 | 0 |
| `SecurityEndpointsTest` | 12 | 0 | 0 | 0 |
| `AuthFlowIntegrationTest` | 8 | 0 | 0 | 0 |
| `AuthServiceTest` | 14 | 0 | 0 | 0 |
| **Total** | **55** | **0** | **0** | **0** |

`LandNexus-frontend`: `npm test -- --run src/features/admin/users/UsersPage.test.tsx` passed 6 tests. Subsequently, after the dashboard analytics change, the complete backend suite passed 579 tests with no failures/errors/skips, the full frontend suite passed 50 files / 250 tests, and `npm run build` exited successfully. The full backend suite applied/validated migrations through V25.
