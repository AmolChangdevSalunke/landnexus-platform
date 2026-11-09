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
Read this first: the integration tests run against the REAL configured database and create and delete their own test rows.
Never point them at a database that holds data you care about. The same environment variables must be set.

## 7. Run the frontend
```powershell
cd LandNexus-frontend
npm install
Copy-Item .env.example .env        # VITE_API_BASE_URL=http://localhost:8080/api/v1
npm run dev
```
Open http://localhost:5173. Keep this port: the backend only allows that origin by default (`CORS_ALLOWED_ORIGINS`).
Quality checks: `npm run build` and `npm run test`.

## 8. See everything working: the end-to-end DEMO
With the backend running (step 5), in a new window with the same `LANDNEXUS_ADMIN_*` variables:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\full-demo.ps1
```
It creates synthetic DEMO data for a whole acquisition (proposal to project, land records, survey, notices, award, compensation,
simulated payments, R&R, GIS, dashboards, SLA) and prints PASS/FAIL for every step. Add `-ShowCredentials` to print the DEMO user
names and password of that run so you can log in to the frontend as, for example, the field officer or the competent authority.
Those accounts are synthetic and local only. Re-running adds new DEMO data with a new random suffix (history and audit rows are append-only by design).

## 9. Roles in the demo
CONSULTANT (proposals), SCRUTINY_OFFICER (scrutiny, land records, verification, estimates), COMPETENT_AUTHORITY (decisions, approvals),
FIELD_OFFICER (surveys, boundaries, parcels), FINANCE_OFFICER (payments, read-only reports), SUPER_ADMIN/CENTRAL_ADMIN (master data, users, rules, SLA settings).

## 10. Troubleshooting
| Symptom | Cause and fix |
|---|---|
| `psql` is not recognised | add `C:\Program Files\PostgreSQL\18\bin` to `$env:Path` in that window |
| The app stops at start with a missing property | an environment variable is not set in THIS window |
| 404 `No static resource api/v1/...` | an old backend is still running on port 8080: stop it and start the new jar |
| 401 on every call | the token expired (15 minutes): log in again |
| Browser says CORS error | run the frontend on http://localhost:5173 or set `CORS_ALLOWED_ORIGINS` |
| Flyway or PostGIS error at start | PostGIS is not installed for that PostgreSQL, or the DB user cannot create extensions |
| An entry made between 00:00 and 05:30 IST rejects "today" | known limitation: business dates are validated in UTC |

## 11. Known limits (also in docs/PROJECT_STATUS.md)
Payments are simulated; uploaded files are not virus-scanned or encrypted at rest; there is no password reset, no rate limiting and no OpenAPI page yet;
access tokens stay valid up to 15 minutes after a user is disabled; the SLA scheduler is off by default (`LANDNEXUS_SLA_SCHEDULER=true` turns it on, the manual scan always works).

## Linux notes
Use `./mvnw` instead of `mvnw.cmd`, `export NAME=value` instead of `$env:NAME`, and install PostGIS with `apt install postgresql-18-postgis-3`
(or the package name for your PostgreSQL version). The PowerShell demo script needs PowerShell 7 (`pwsh`) and `curl`.