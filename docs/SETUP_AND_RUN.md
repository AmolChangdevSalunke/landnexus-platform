# LandNexus: set up and run on your own computer

Tested on Windows 11 with PowerShell. Linux is possible (see the notes at the end).

## 1. Install
| Tool | Version | Notes |
|---|---|---|
| JDK | 21 | `java -version` must say 21 |
| Node.js | 18 or newer (22 LTS recommended) | `node -v` |
| PostgreSQL | 18 with the PostGIS extension | on Windows install PostGIS with Stack Builder |
| Git | any recent | |

Maven is NOT needed: the project ships `mvnw.cmd`.

## 2. Get the code
```powershell
git clone https://github.com/AmolChangdevSalunke/landnexus-platform.git
cd landnexus-platform
```

## 3. Database
Create an empty database (the application creates all tables itself with Flyway):
```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql -U postgres -h localhost -c "CREATE DATABASE landnexus_dev;"
```
The default database name and user are in `landnexus-backend/src/main/resources/application.properties`
(`spring.datasource.url`, `spring.datasource.username`). The first start runs `CREATE EXTENSION postgis`, so the
database user must be allowed to do that (the `postgres` user is).

## 4. Environment variables (secrets are never in the code)
See `.env.example` for the list. In PowerShell, for the current window:
```powershell
$env:DB_PASSWORD = "<your postgres password>"
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)          # at least 32 characters
$env:LANDNEXUS_ADMIN_USERNAME = "admin"
$env:LANDNEXUS_ADMIN_PASSWORD = "<choose a strong password>"
New-Item -ItemType Directory -Force D:\landnexus-data\files | Out-Null
$env:LANDNEXUS_STORAGE_DIR = "D:\landnexus-data\files"       # uploaded files are kept here, OUTSIDE the repository
```
The administrator account is created only on the first start, while the users table is empty.
Every new PowerShell window needs these variables again (or set them permanently with `setx`, then open a new window).

## 5. Run the backend
```powershell
cd landnexus-backend
.\mvnw.cmd clean verify -DskipTests
java -jar target\landnexus-backend-0.0.1-SNAPSHOT.jar
```
It listens on http://localhost:8080. If you changed the code, stop the old process first, or you will be talking to the old version.
Check: `Invoke-RestMethod http://localhost:8080/api/v1/auth/login -Method Post -ContentType application/json -Body '{"username":"admin","password":"..."}'`.

## 6. Run the tests (optional, takes a few minutes)
```powershell
cd landnexus-backend
.\mvnw.cmd clean verify
```
Database integration tests require a separately created disposable PostgreSQL/PostGIS database through
`LANDNEXUS_TEST_DB_URL`, `LANDNEXUS_TEST_DB_USERNAME` and `LANDNEXUS_TEST_DB_PASSWORD`. The test guard refuses
`landnexus_dev`; do not point tests at a shared or production database. Use a new database name and do not reset
or drop an existing database to rerun tests.

```powershell
psql -U postgres -h localhost -c "CREATE DATABASE landnexus_test_new;"
$env:LANDNEXUS_TEST_DB_URL = "jdbc:postgresql://localhost:5432/landnexus_test_new"
$env:LANDNEXUS_TEST_DB_USERNAME = "postgres"
$env:LANDNEXUS_TEST_DB_PASSWORD = "<your postgres password>"
.\mvnw.cmd test
```

## 7. Run the frontend
```powershell
cd LandNexus-frontend
npm install
Copy-Item .env.example .env        # VITE_API_BASE_URL=http://localhost:8080/api/v1
npm run dev
```
Open http://localhost:5173. Keep this port: the backend only allows that origin by default (`CORS_ALLOWED_ORIGINS`).
Quality checks: `npm run build` and `npm run test`.
The GIS workspace uses the public OpenStreetMap tile service as its interactive fallback and requires network access to load tiles. Optional imagery settings are documented in `docs/IMAGERY_SETUP.md`; do not configure an unverified endpoint or label it connected unless its live check succeeds.

## 8. ISRO Bhuvan API access key (optional)
The Bhuvan LULC/village integration is implemented in the backend (`/api/v1/gis/bhuvan/...`) and in the frontend
GIS → Analysis page. It is **off by default** and no live Bhuvan success is claimed until you configure a real token.

1. Request API access from ISRO/NRSC Bhuvan (the Bhuvan API portal or the Bhuvan office that issued your account).
   The access key is account-specific; LandNexus cannot issue one and none is stored in the repository.
2. Put the key in the **backend** environment only (never in `VITE_*`, browser storage, source code, screenshots or chat):
```powershell
$env:BHUVAN_API_TOKEN = "<your Bhuvan access key>"
$env:LANDNEXUS_BHUVAN_ENABLED = "true"
```
3. Restart the backend. Verify the status endpoint after logging in with a GIS-enabled account:
```powershell
Invoke-RestMethod http://localhost:8080/api/v1/gis/bhuvan/status -Headers @{ Authorization = "Bearer <access-token>" }
```
`tokenConfigured` and `lulcAvailable` should be `true`; the token itself is never returned.
4. Run the provider check (it calls Bhuvan but prints no token):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-bhuvan.ps1
```
5. Use **GIS → Analysis** in the frontend or `POST /api/v1/gis/bhuvan/lulc/aoi` with `{"projectId":"..."}` or a
   WKT Polygon. Village geocoding is enabled only for Andhra Pradesh (AP) and Karnataka (KA) because those are the
   states Bhuvan documents. Maharashtra is refused until a real successful Maharashtra check has been recorded and
   `LANDNEXUS_BHUVAN_MAHARASHTRA_VILLAGE_VERIFIED=true` is set.

Optional tuning: `LANDNEXUS_BHUVAN_BASE_URL`, `LANDNEXUS_BHUVAN_TIMEOUT_SECONDS`, `LANDNEXUS_BHUVAN_MAX_BYTES`,
`LANDNEXUS_BHUVAN_VILLAGE_STATES=AP,KA`. On a `502 AUTHENTICATION_FAILED`, the key is invalid/expired or not enabled
for that API; Bhuvan may report this as HTTP 200 with an `error` object. Never put the key in a query string you share.

## 9. Logging
The backend uses the SLF4J/Logback already supplied by Spring Boot. Configuration is centralized in
`landnexus-backend/src/main/resources/logback-spring.xml`; every request gets an `X-Request-Id` (also returned in the
response and shown in the logs). Development prints Spring Boot-style console lines. The `prod` profile
(`SPRING_PROFILES_ACTIVE=prod`) additionally writes daily/size-rotated files under `logs/`:
`landnexus.log` (text) and `landnexus.jsonl` (one JSON object per line), with 30-day / 2 GB caps.

| Variable | Default | Purpose |
|---|---|---|
| `LANDNEXUS_ENV` | `dev` | Environment label in JSON logs |
| `LANDNEXUS_LOG_LEVEL_ROOT` | `INFO` | Root level |
| `LANDNEXUS_LOG_LEVEL_APP` | `INFO` (`DEBUG` in the `dev` profile) | `com.landnexus` level |
| `LANDNEXUS_LOG_LEVEL_FRAMEWORK` | `WARN` | Spring/Hikari level |
| `LANDNEXUS_LOG_LEVEL_SQL` | `WARN` | Hibernate SQL level (keep quiet: bound values may be personal data) |
| `LANDNEXUS_LOG_DIR` | `logs` | Production log directory |

Use `LANDNEXUS_LOG_LEVEL_APP=DEBUG` for CRUD/business detail. Never log tokens, passwords, authorization headers or
response bodies. The frontend logger is `LandNexus-frontend/src/logging/logger.ts`; it uses a matching console format
in development, JSON at `WARN`+ in production, and can be tuned with `VITE_LOG_LEVEL` (`debug`, `info`, `warn`, `error`).

## 10. See everything working: the end-to-end DEMO
With the backend running (step 5), in a new window with the same `LANDNEXUS_ADMIN_*` variables:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\full-demo.ps1
```
It creates synthetic DEMO data for a whole acquisition (proposal to project, land records, survey, notices, award, compensation,
simulated payments, R&R, GIS, dashboards, SLA) and prints PASS/FAIL for every step. Add `-ShowCredentials` to print the DEMO user
names and password of that run so you can log in to the frontend as, for example, the field officer or the competent authority.
Those accounts are synthetic and local only. Re-running adds new DEMO data with a new random suffix (history and audit rows are append-only by design).

## 11. Roles and administration in the demo
The seed creates synthetic accounts for the supported roles. Use `-ShowCredentials` with the demo script to print that run's generated credentials; do not copy production credentials into source or documentation. The role permission matrix is at `/admin/roles`, user administration is at `/admin/users`, and proposal routing rule configuration is at `/admin/routing-rules`; each requires the corresponding backend permission. Users can edit account email/display name, roles and existing geographic scopes. Geographic user scopes currently stop at state/division/district; taluka/village permission inheritance is not implemented. Routing configuration does not provide named officer targets.

MIS reports at `/monitoring/reports` use database views and support state, district, status, date, project and district-selected taluka filters. The main dashboard supports project/taluka/date filters and database-backed GIS conflict, pending-task, escalation-level and permission-gated officer workload aggregates. Dashboard status filtering/export is not implemented; district comparison and trend do not narrow by those dashboard filters. PFMS/DBT rail breakdowns remain unavailable until the payment schema records an explicit rail.

Latest database verification (15 Nov 2026): the full backend suite passed 579 tests with Flyway through V25; focused user permission/authentication tests passed 55 tests; the demo script passed twice with 193 checks each; filtered dashboard and MIS values matched direct PostgreSQL queries for sampled aggregates. On 16 Nov, frontend tests passed 50 files/250 tests and production build exited successfully, and backend compile plus focused dashboard/role unit tests passed. V26 is present but has not yet been applied or verified against PostgreSQL because the isolated database settings were unavailable. Flyway applies V24-V26 on startup. Access-token validation checks the current user authorization version in PostgreSQL, so authenticated requests depend on database availability. See `docs/TESTING_AND_VERIFICATION.md` and `docs/FINAL_ACCEPTANCE_REPORT.md` for exact limits and counts.

## 12. Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `psql` is not recognised | add `C:\Program Files\PostgreSQL\18\bin` to `$env:Path` in that window |
| The app stops at start with a missing property | an environment variable is not set in THIS window |
| 404 `No static resource api/v1/...` | an old backend is still running on port 8080: stop it and start the new jar |
| 401 on every call | the token expired (15 minutes): log in again |
| Authenticated requests fail while PostgreSQL is unavailable | current token-version validation requires a live user/authorization-version lookup; restore DB availability |
| Browser says CORS error | run the frontend on http://localhost:5173 or set `CORS_ALLOWED_ORIGINS` |
| Flyway or PostGIS error at start | PostGIS is not installed for that PostgreSQL, or the DB user cannot create extensions |
| An entry made between 00:00 and 05:30 IST rejects "today" | known limitation: business dates are validated in UTC |

## 13. API and integrations
REST endpoints are rooted at `/api/v1`. The generated OpenAPI document is available at `http://localhost:8080/api/v1/meta/openapi.json`; the endpoint catalogue is in `docs/API_DOCUMENTATION.md`. Flyway migrations run on backend startup. Payments are simulated only; a standalone DBT/NPCI beneficiary workflow and real PFMS integration are not implemented. No live Bhuvan service is claimed; the GIS map uses OSM fallback tiles.

## 14. Known limits (also in docs/PROJECT_STATUS.md)
Payments are simulated; payment-channel labels do not connect to PFMS/DBT or transfer funds; uploaded files are not virus-scanned or encrypted at rest; there is no rate limiting; and the SLA scheduler is off by default (`LANDNEXUS_SLA_SCHEDULER=true` turns it on, while the manual scan remains available). V25 authorization-version checks invalidate access tokens after user/role/permission changes. The demo does not implement every requested NLAMS acceptance criterion; see `docs/DEMO_READINESS.md` and `docs/KNOWN_ISSUES.md`.

## Linux notes
Use `./mvnw` instead of `mvnw.cmd`, `export NAME=value` instead of `$env:NAME`, and install PostGIS with `apt install postgresql-18-postgis-3`
(or the package name for your PostgreSQL version). The PowerShell demo script needs PowerShell 7 (`pwsh`) and `curl`.