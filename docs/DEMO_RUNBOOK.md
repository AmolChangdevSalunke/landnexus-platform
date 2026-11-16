# LandNexus — Demo Runbook (frontend only)

**Date:** 12 November 2026
**Rule:** every demo step is performed in the browser at `http://localhost:5173`. Do not call the API by hand during the demo. The only shell commands are the ones that start the system and seed synthetic data.
**Safety:** all data is synthetic and labelled `DEMO`. Compensation is **SIMULATED**; no real money moves.

---

## 0. What you need

| Item | Value |
|---|---|
| Java | 21 |
| Node.js | 18+ (22 LTS recommended) |
| PostgreSQL | 18 with PostGIS |
| Database used for the demo | `landnexus_demo` (separate from `landnexus_dev`) |
| Backend | `http://localhost:8080` |
| Frontend | `http://localhost:5173` |
| Browser | Chrome/Edge, width at least 360 px is supported |

Secrets stay in PowerShell environment variables. They are never written to a file in the repository.

---

## 1. One-time setup in the current PowerShell window

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
$env:DB_PASSWORD = "<postgres password>"
$env:DB_USERNAME = "postgres"
$env:DB_URL = "jdbc:postgresql://localhost:5432/landnexus_demo"
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
$env:LANDNEXUS_ADMIN_USERNAME = "admin"
$env:LANDNEXUS_ADMIN_PASSWORD = "<demo admin password>"
$env:LANDNEXUS_STORAGE_DIR = "D:\landnexus-data\files"
New-Item -ItemType Directory -Force $env:LANDNEXUS_STORAGE_DIR | Out-Null
```

`LANDNEXUS_SLA_SCHEDULER` stays unset/false for the standard demo. Set `"true"` only if you want the SLA scan to run by itself. `LANDNEXUS_IMAGERY_ENABLED` stays false (ISRO Bhuvan is out of scope).

---

## 2. Reset the demo database (repeat before every demo run)

```powershell
cd D:\landnexus-platform
powershell -ExecutionPolicy Bypass -File scripts\reset-demo-db.ps1
```

Expected output: `Demo database recreated. Now start the backend (it creates the tables), then run demo-seed-real.ps1.` Enter the postgres password when `psql` prompts. This only touches `landnexus_demo`.

---

## 3. Build and start the backend

```powershell
cd D:\landnexus-platform\landnexus-backend
.\mvnw.cmd -q -DskipTests package
java -jar target\landnexus-backend-0.0.1-SNAPSHOT.jar
```

Wait for `Started LandnexusApplication` and keep this window open. Flyway applies V1–V18 to `landnexus_demo` on the first start.

**Health check (a separate window, same environment variables):**

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/auth/login -Method Post -ContentType application/json `
  -Body (@{ username = $env:LANDNEXUS_ADMIN_USERNAME; password = $env:LANDNEXUS_ADMIN_PASSWORD } | ConvertTo-Json)
```

A JSON access token means the backend is up. Do not paste the token anywhere public.

---

## 4. Seed the synthetic demo data

In a **new** PowerShell window with the same environment variables:

```powershell
cd D:\landnexus-platform
powershell -ExecutionPolicy Bypass -File scripts\demo-seed-real.ps1
```

What it creates:

- one state/district/talukas/villages with public Maharashtra place names;
- five role users scoped to the district, plus a central rule-maker;
- land parcels with synthetic owners, shares and drawn boundaries;
- an **approved dam project** with an acquisition case already progressed to a later lifecycle stage;
- a **road project kept for the live demo**: the proposal is not yet approved, so you can submit it live;
- rate cards, valuation rules, valuation, simulated payments, R&R benefits/cases;
- a presenter folder on the Desktop: `LandNexus-demo-files` with a cheat sheet, two GeoJSON alignments and sample files.

At the end it prints:

```
================ DEMO READY ================
Frontend http://localhost:5173    Backend http://localhost:8080
...
LOGINS (one password for all, synthetic, local only ...)
  password: Demo-Passw0rd-<random>
  consultant  demo-consultant-<random>  CONSULTANT
  officer     demo-officer-<random>     SCRUTINY_OFFICER
  authority   demo-authority-<random>   COMPETENT_AUTHORITY
  field       demo-field-<random>       FIELD_OFFICER
  finance     demo-finance-<random>     FINANCE_OFFICER
  rulemaker   demo-rulemaker-<random>   CENTRAL_ADMIN
  admin       <LANDNEXUS_ADMIN_USERNAME> SUPER_ADMIN
```

Copy the usernames and password into a private note. **Do not commit them and do not paste them into any file.** The printed password is local and synthetic.

---

## 5. Start the frontend

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Open `http://localhost:5173`. Keep port 5173: the backend allows that origin by default.

---

## 6. Demo path, in order

Log out between roles with the account menu (top right). The login page is `/login`.

### Item 1 — Approval Workflow (REAL)

**1a. Consultant submits**

1. Log in as the **consultant**.
2. Open **Proposals → New proposal**.
3. Use the cheat sheet values from the Desktop folder: title `DEMO Manchar Bypass, four-laning (illustrative)`, type **State highway**, the seeded taluka and its three villages, length and area from the sheet, department **Public Works Department**, dates from the sheet.
4. Save the draft. Open it and press **Submit for scrutiny**.
5. Show: status **Submitted**, history entry **Submitted for scrutiny**, version **v1**, and a success toast.

**1b. Scrutiny officer works the task**

1. Log out; log in as the **officer**.
2. **My work** shows a **My tasks** row: stage *Scrutiny*, due date, no overdue badge.
3. Open the task. Press **Start scrutiny**.
4. Press **Recommend** (optional remarks). The proposal moves to **Recommended**.

**1c. Competent authority decides**

1. Log out; log in as the **authority**.
2. **My work → My tasks** shows the *Decision* stage row.
3. Open it. Press **Approve**. In the dialog press **Approve and create project**.
4. Show the toast: the project code was created and acquisition initiation started.
5. Open **Proposals → the proposal**: status **Approved**, stepper all green, history shows every action, versions show v1.
6. Open **Projects → the new project**. It exists without any manual creation.

Optional: show that a field officer sees **no** action buttons and only the read-only history. The backend would answer 403 if an action were forced; the UI never renders the button.

### Item 2 — 7-step Automated Proposal Approval Workflow (PARTIAL)

Do this immediately after Item 1, without reseeding:

1. On the proposal details page, point at the **stepper**: Draft → Submitted → Scrutiny → Recommended → Approved. Each step has a word label (`Completed`, `Current step`, `Not reached`), not colour alone.
2. Point at the **Scrutiny assignment** / **Decision assignment** card: assigned user, *automatic* vs named assigner, assigned date, due date, and the rule note such as `Decision routing: ... (DISTRICT)`.
3. Open **My work** as the officer/authority again and show the same task rows with the **Overdue** badge when a due date has passed (the seed leaves recent tasks, so this may show as not overdue).
4. Open **Monitoring and MIS → NLAMS progress** and show the new project's row with its stage and 20 % milestones.

What to say honestly: steps 2–3, 5 and the bookkeeping are automatic; the statutory decision stays with a human; routing rules are currently seeded by Flyway and have **no admin screen** yet.

### Item 3 — End-to-End Workflow Automation (REAL for the handoff)

1. With the approved proposal still open, show the project and the acquisition case number in the approval result / proposal response area.
2. Open **Acquisition → Acquisition cases**. There is exactly one case for the new project; there is no "create case" step.
3. Open the case. Show **Villages and parcels**: the project villages are already copied into the case.
4. Show the case **History**: the automatic initiation entry is recorded.
5. Open the seeded **dam case** and walk its tabs to show the officer-driven lifecycle: Surveys → Verification report → Notices → Objections → Award → Possession. This is the part that remains human-driven by law.

If someone asks "is every step automatic?", the answer is no: proposal approval → project → acquisition case is automatic; survey, notice, objection, award and possession are officer actions recorded in the UI.

### Item 4 — Real-Time Dashboard & Analytics (PARTIAL)

1. As `admin` (SUPER_ADMIN) open **Monitoring and MIS → Monitoring dashboard**. Show the KPI cards, status distribution, trend, district table and the **SIMULATED** banner on compensation figures.
2. Change the state/district filter; the numbers and the scope line change.
3. Open **Monitoring and MIS → NLAMS progress**.
4. Point at **Updated at HH:mm:ss** and **Auto-refreshes every 30 seconds**.
5. Leave the tab visible for 30 seconds and show the timestamp change. Switch to another browser tab for 30 seconds and show that the hidden tab does not refresh; return and it refreshes again.
6. Show the project table: stage, 20 %-step progress bar, parcel counts, area, and stage totals.
7. Open **Projects**, **Districts and states**, **Acquisition lifecycle**, **Compensation** and **MIS reports** to show the other analytics views.
8. Say honestly: only the NLAMS page polls; the other pages refresh on navigation/manual refresh; there is no WebSocket feed or export of the NLAMS table.

### Item 5 — Compensation & R&R Tracking (REAL)

Use the seeded dam case, or the newly approved case with its seeded valuations.

1. Log in as **finance** (or `admin`) and open **Acquisition → the dam case**.
2. Open the **Valuation** tab. Show the rate card/rule set used, components and totals. Money is formatted by the server, never summed in the browser.
3. Open the **Payments** tab. Show the **SIMULATED** banner, payment lifecycle, event history and the payment summary.
4. Open the **R&R** tab. Show R&R cases, entitlements and delivery progress. Open a case to show the family record (`/compensation/rr-cases/:id`).
5. As `admin`, open **Compensation → Rate cards and rule sets** and **Compensation → R&amp;R benefit catalogue** to show rate approval and benefit types.
6. Open **Monitoring and MIS → Compensation** for the aggregated view.
7. Say: PFMS/DBT are not connected; payments are simulated end-to-end; no bank/caste/religion/Aadhaar fields exist.

### Item 6 — Automated Notifications & Alerts (PARTIAL)

1. Log in as the **officer** or **authority**. Point at the unread badge in the shell.
2. Open **Notifications**. Show the assignment notification created by routing (*Proposal assigned to you*) and workflow notifications (submitted, recommended, approved, rejected).
3. Mark one as read; the unread count drops.
4. Open **Monitoring and MIS → SLA and alerts** as `admin`.
5. Show open items with **BREACH** / **WARNING** text, the at-risk forecast, the rules list and the escalation log.
6. Trigger a scan with the **Scan now** action (requires `SETTINGS_MANAGE`). New escalations appear and a notification is written.
7. Say honestly: delivery is in-app only (no e-mail/SMS); the background scheduler is off by default, so alerts appear after a manual scan; there are no per-user alert preferences.

---

## 7. If something fails during the demo

| Symptom | Cause | Fix |
|---|---|---|
| Login says network error | backend stopped or wrong `VITE_API_BASE_URL` | restart the jar; check `.env` has `http://localhost:8080/api/v1` |
| `Flyway ... uq_acquisition_cases_project` / duplicate-case error | backend pointed at `landnexus_dev` | stop it, set `DB_URL` to `landnexus_demo`, reset the demo DB, restart |
| No **My tasks** rows | seed/users not present, or no user with the role in the district | re-run the seed; check the users have district scope |
| 404 on a case/proposal | the record is outside the logged-in user's district | log in with the scoped demo user or `admin` |
| 403 on an action | the role lacks the permission | use the role printed by the seed (officer/authority/finance) |
| Approve button missing | already approved, or the user recommended it (maker-checker) | show the read-only final state; use a different authority |
| NLAMS page empty | no approved project in the selected scope | clear the district filter or approve the road proposal first |

Never "fix" a demo by editing the database during the presentation. Reset the demo DB and re-seed before the audience arrives.

---

## 8. Pre-demo checklist (5 minutes)

- [ ] `landnexus_demo` reset and backend restarted on the **current** jar.
- [ ] Seed finished with `DEMO READY` and the login list is on a private note.
- [ ] Frontend on `http://localhost:5173`; `/login` loads without console errors.
- [ ] `admin` can open **Monitoring and MIS → NLAMS progress** and the timestamp updates after 30 s.
- [ ] The seeded dam case opens and its Valuation/Payments/R&R tabs render with **SIMULATED**.
- [ ] The road proposal is in the state you expect (draft/submitted) for the live demo.
- [ ] Browser zoom 100 %, window at least 1280 px wide for the tables; also test 360 px width once for responsiveness.
- [ ] Notifications unread badge is non-zero for the officer/authority.
- [ ] No password or token is visible on screen, in a file, or in the repository.

---

## 9. Verification commands (run outside the demo, not during it)

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npx tsc -b
npm run test
npm run build
```

```powershell
cd D:\landnexus-platform\landnexus-backend
.\mvnw.cmd -q -DskipTests test-compile
.\mvnw.cmd test "-Dtest=ProposalRoutingServiceTest,ProposalServiceTest,AdministrationLookupServiceTest,NlamsMonitoringServiceTest,ProposalControllerTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Database tests require a separately created disposable database. Do not drop or reset a
database to rerun them; choose a fresh name and never target `landnexus_dev` or `landnexus_demo`.

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql -U postgres -h localhost -c "CREATE DATABASE landnexus_test_new;"
cd D:\landnexus-platform\landnexus-backend
$env:LANDNEXUS_TEST_DB_URL = "jdbc:postgresql://localhost:5432/landnexus_test_new"
$env:LANDNEXUS_TEST_DB_USERNAME = "postgres"
$env:LANDNEXUS_TEST_DB_PASSWORD = "<password>"
.\mvnw.cmd test
```

The latest backend suite and two full-demo executions were run against the disposable
`landnexus_nlams_test_20261115` database; see `docs/TESTING_AND_VERIFICATION.md`.
