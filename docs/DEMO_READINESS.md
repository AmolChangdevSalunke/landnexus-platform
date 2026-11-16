# LandNexus — Demo Readiness

**Date:** 15 November 2026
**Scope:** readiness of the existing NLAMS demo, including role/routing administration, GIS map uploads and audited proposal reassignment. This does not claim that every requested acceptance criterion is complete. BhuNaksha, 7/12, 8A, Ferfar, Mahabhulekh, real PFMS/DBT, verified ISRO Bhuvan, digital signatures, SMS, the citizen portal and offline sync are not connected.
**Data rule:** every seeded record is synthetic and labelled `DEMO`. All payment figures are **SIMULATED**; no real money moves.

This file is the honest status board. It says what can be shown through the React frontend, what is partial, and what is not implemented. The step-by-step click path is in `docs/DEMO_RUNBOOK.md`.

---

## 1. Verification actually performed (15 Nov 2026)

| Command | Working directory | Actual result |
|---|---|---|
| `.\mvnw.cmd test` (disposable `landnexus_nlams_test_20261115`) | `landnexus-backend` | **579 tests, 0 failures/errors/skips**, migrations through V25 |
| `npm test` | `LandNexus-frontend` | **50 files, 250 tests passed** after dashboard response fixture updates |
| `npm run build` | `LandNexus-frontend` | exit 0; production bundle built (chunk-size warning only) |
| `npx tsc -b` | `LandNexus-frontend` | exit 0, no diagnostics |
| `.\mvnw.cmd -q -Dtest=DocumentServiceTest test` | `landnexus-backend` | 17 tests, 0 failures |

**Not run, and not claimed:** `.\mvnw.cmd clean verify`, Docker/Testcontainers concurrency verification, a standalone GIS upload/conflict test, real e-mail/SMS delivery, and any government integration. The full backend suite, full-demo script, direct SQL comparisons, and scheduled SLA behavior did run against the disposable database; see `docs/TESTING_AND_VERIFICATION.md`.

**Latest database verification (through V25):** the full backend suite passed 579 tests against the isolated PostgreSQL/PostGIS database. Frontend `npm test` passed 50 files / 250 tests and the production build exited 0; the dashboard fixtures include operational aggregates. Two executions of `scripts/full-demo.ps1` each reported 193 checks passed and 0 failed. Filtered dashboard proposal/project/acquisition/pending-task values matched direct SQL in PostgreSQL integration tests. Six current parcel boundaries were valid; selected project/acquisition/payment/R&R orphan checks returned zero. V26 now adds explicit simulated payment-channel classification; no real PFMS/DBT integration exists.

**16 Nov 2026 continuation:** V26 now adds explicit simulated payment-channel classification and dashboard status/channel filtering in code. The frontend suite passed 50 files / 250 tests before the role-history panel was added; the focused RolesPage suite passed 3 tests afterward, and the production build succeeded. Backend compile and focused `DashboardServiceTest`/`RoleServiceTest` passed. V26 was not migrated or SQL-verified: all three `LANDNEXUS_TEST_DB_*` variables were absent. The prior 579-test/PostgreSQL and demo-seed results are historical evidence through V25 only and do not verify V26.

The initial backend suite run exposed one Spring test context that did not inherit the isolated database guard and therefore applied additive V23 report views to `landnexus_dev`. The test class now inherits the guard; the full rerun used only the dedicated disposable database. V23 is additive (`CREATE OR REPLACE VIEW`); no data rows were modified by that migration.

The earlier duplicate-acquisition-case data issue was reconciled on 14 Nov 2026 (see `docs/PROJECT_STATUS.md`). Use a dedicated demo/test database; do not reset or delete data in a shared database.

---

## 2. The six demo items

| # | Demo item | Status | Frontend entry point | Backend proof |
|---|---|---|---|---|
| 1 | Approval Workflow | **REAL** | `/proposals`, `/proposals/:id` | `ProposalWorkflow`, `ProposalService`, `ProposalController` |
| 2 | 7-step Automated Proposal Approval Workflow | **PARTIAL** (automatic routing and audited manual reassignment exist; named routing targets and configurable escalation remain incomplete) | `/proposals/:id` (stage stepper and permitted reassignment), `/` (My tasks), `/admin/routing-rules` | `ProposalRoutingService`, `ProposalAssignmentAdminService`, `RoutingRuleAdminService`, V17, V22, reassignment APIs |
| 3 | End-to-End Workflow Automation | **REAL for the proposal → project → acquisition-case handoff** | `/proposals/:id`, `/acquisition/:id` | `ProposalApprovedCaseInitiator`, `AcquisitionCaseInitiator`, `ProposalService.approve`, V16 |
| 4 | Real-Time Dashboard & Analytics | **PARTIAL** (NLAMS page polls; other monitoring pages are snapshots) | `/monitoring`, `/monitoring/nlams` | `DashboardService`, `NlamsMonitoringService`, `NlamsRepository`, V18 `rpt_project_progress` |
| 5 | Compensation & R&R Tracking | **REAL** | Acquisition case tabs (`Valuation`, `Payments`, `R&R`), `/compensation/...`, `/monitoring/compensation` | `compensation` module, `PaymentsTab`, `RrTab`, `CompensationMonitoringPage` |
| 6 | Automated Notifications & Alerts | **PARTIAL** (in-app only; scheduler off by default; no e-mail/SMS) | bell in the shell, `/notifications`, `/monitoring/sla` | `NotificationService`, `SlaService`, `SlaLookupService`, SLA escalation scan |

Legend: **REAL** = demonstrable end-to-end through the UI against the running backend. **PARTIAL** = the main path works, but a listed part is missing. **MISSING** = nothing to show.

---

## 3. Item-by-item detail

### 3.1 Approval Workflow — REAL

- Consultant creates a draft, submits; version v1 is frozen at submission.
- Scrutiny officer starts scrutiny, can request a clarification with a mandatory reason; the consultant resubmits (v2, v3, …).
- Scrutiny officer recommends; competent authority approves or rejects. Rejection needs a reason.
- Maker-checker is enforced in the backend: nobody reviews their own proposal, and the recommending officer cannot decide it.
- The UI renders only the actions returned in `availableActions`; 409 conflict messages are shown as text.
- History (`proposal_status_history`) and versions (`proposal_versions`) are append-only; every action also writes an audit event.
- **Gap:** no bulk approval, no delegation/out-of-office, no proposal-level attachment upload. Attachments exist in the separate document register.

### 3.2 7-step Automated Proposal Approval Workflow — PARTIAL

The seven steps map onto the existing statuses without adding new proposal statuses:

| Step | What happens | Automation |
|---|---|---|
| 1. Draft | Consultant enters proposal data | manual |
| 2. Validate and submit | `ProposalValidationService` blocks `SUBMIT`/`RESUBMIT` on FAIL items; number and version are taken from native sequences | automatic gate |
| 3. Route to scrutiny | `ProposalRoutingService` picks the least-loaded `SCRUTINY_OFFICER` in the district, excluding the owner; writes `proposal_assignments`, notification, `AUTO_ASSIGN` audit | automatic |
| 4. Scrutinise / clarify / resubmit | Existing workflow; the open assignment becomes `IN_PROGRESS` | manual work, automatic bookkeeping |
| 5. Recommend and route to decision | Matching `routing_rules` choose `DISTRICT` (≤ 100 ha) or `STATE` (> 100 ha), project-type-specific rule wins; recommender excluded | automatic |
| 6. Approve / reject | Existing maker-checker; assignment is `COMPLETED`; project and acquisition case are created | manual decision, automatic artefacts |
| 7. Monitor | Stage stepper on the proposal, My tasks table, NLAMS progress page, SLA and notifications | automatic |

- If no candidate exists the transition still succeeds: the assignment is recorded as unassigned, an `UNASSIGNED` audit event is written, and district admins are notified. A proposal is never stuck because routing failed.
- `due_at` reuses the SLA warning hours for `PROPOSAL_AWAITING_SCRUTINY` (default 120 h).
- **Implemented:** authorized administrators can list, create, update, activate and deactivate routing rules in `/admin/routing-rules`. The API validates rules, prevents disabling the last active rule, and audits mutations. Rules configure proposal/project type, area thresholds and decision level.
- **Implemented:** users with `PROPOSAL_ASSIGNMENT_MANAGE` can fetch eligible officers and manually reassign the open task. The backend checks proposal state, current assignment, district scope and candidate eligibility; it records the reassignment reason in audit history and notifies the new assignee. The proposal detail UI refreshes the assignment history after success.
- **Gap:** named officers and escalation targets are not configured in routing rules. SLA periods remain configured separately; this screen does not edit SLA schedules. Reassignment is covered by the backend suite, but an isolated end-to-end reassignment scenario was not separately measured.

### 3.3 End-to-End Workflow Automation — REAL for the defined handoff

- On approval the same transaction creates the project and then calls `ProposalApprovedCaseInitiator`, which creates exactly one acquisition case per project (V16 unique constraint), copies the project villages, writes `AUTO_INITIATE` history and audit, and returns the case number in the proposal response.
- Repeated approval is idempotent: the committed project and case are returned without duplicate history, audit or notifications.
- Constraint conflicts are not recovered inside an aborted PostgreSQL transaction. The attempt transaction rolls back and a fresh transaction reads the committed winner.
- **Boundary:** the acquisition lifecycle itself (survey, notice, objection, award, possession, closure) remains an officer-driven workflow in the UI. "End-to-end" here means no manual re-entry between proposal approval and the acquisition case. It does not mean every statutory step is automated.

### 3.4 Real-Time Dashboard & Analytics — PARTIAL

- `/monitoring` shows proposals by status, projects, land, acquisition, compensation, GIS conflicts, pending tasks, escalation counts, permission-gated officer workload and district rows, limited by the user's geographic scope. Project, taluka and inclusive date filters are checked against geographic scope by the backend and use PostgreSQL aggregates.
- `/monitoring/nlams` is new: five equal milestones × 20 % (case started, parcels identified, notification complete, award declared, possession complete), per-project progress table, counts and areas, projects by stage, totals, and `Updated at HH:mm:ss`.
- The NLAMS page polls every 30 seconds **only while the browser tab is visible**; every page also has an explicit Refresh button.
- **Gap:** only the NLAMS page polls. The other monitoring pages and MIS reports are snapshots refreshed on navigation/manual refresh. There is no push/WebSocket feed or export of the NLAMS table. District comparison and six-month trend remain scope-wide rather than narrowed by dashboard project/taluka/date filters. PFMS and DBT are not separately measurable because the payment schema has no rail classification. Trend charts use stored stage durations, not live events.

### 3.5 Compensation & R&R Tracking — REAL

- Inside an acquisition case: `Valuation` (rate cards, rule sets, valuation calculation and approval), `Payments` (SIMULATED), `R&R` (R&R cases, entitlements, delivery).
- Dedicated pages: rate rules, rule-set detail, valuation detail, R&R case detail, benefit catalogue.
- `/monitoring/compensation` aggregates estimate/payment/R&R progress for the current scope.
- Every payment screen carries the **SIMULATED** banner; no bank account, caste, religion or Aadhaar fields exist.
- A confirmed simulated transaction has a protected, no-store text receipt download. The receipt contains no bank data or owner name.
- **Gap:** this is not the requested separate DBT beneficiary/NPCI workflow. No real PFMS/DBT integration exists; payment statuses and retries are limited to the existing compensation lifecycle.

### 3.6 Automated Notifications & Alerts — PARTIAL

- In-app notifications are created automatically on submit, resubmit, scrutiny start, clarification, recommendation, approval, rejection, reassignment, unassigned routing and SLA escalation. Routing sends targeted notifications to the chosen officer.
- The shell shows an unread count; `/notifications` lists, filters unread and marks read. Users only ever see their own notifications.
- `/monitoring/sla` shows breach/warning items, at-risk forecast, rules (read-only for most roles) and the escalation log; `POST /monitoring/sla/scan` can be triggered by a user with `SETTINGS_MANAGE`.
- **Gap:** delivery is in-app only — no e-mail or SMS (out of scope). The background scheduler is **OFF** unless `LANDNEXUS_SLA_SCHEDULER=true`; without it, alerts appear only after a manual scan. There are no per-user alert preferences or quiet hours.

### 3.7 Interactive GIS map — REAL OSM fallback; external imagery unverified

- `/gis` now renders a Leaflet map using OpenStreetMap tiles and scoped GeoJSON returned by existing project/village GIS APIs. OSM is the default basemap; the map supports pan/zoom, project/parcel layer visibility, survey/Gat search, popup attributes, GeoJSON upload/export, and client-side polygon area measurement.
- Data shown is whatever authorized geometry exists in the backend; the map does not fabricate parcel or boundary records. Empty datasets produce an empty usable map rather than a static placeholder.
- The optional imagery proxy is only reported connected after a successful configured response. The public Bhuvan API portal is reachable, but no authenticated call or live imagery endpoint/layer/CRS/licensing has been verified; `BHUVAN_API_TOKEN` was not present for testing. OSM remains available independently.
- GeoJSON upload can persist polygon parcel boundaries and project alignments through existing GIS APIs when the user has `GIS_WRITE`; PostGIS validation, SRID handling, history, scope checks and audit stay on the backend. Existing project conflict/map APIs remain available. No official boundaries or parcel demo geometries are fabricated.
- **Gap:** the map upload is not a general-purpose import for all three requested geometry types, and acquisition boundary uploads, geometry deletion, full exports/retrieval workflows, conflict statistics/reports and populated Maharashtra administrative boundary data are not complete.

---

## 4. Implemented but intentionally unlinked / incomplete

These must not be demoed as finished:

| Item | State | Where recorded |
|---|---|---|
| Named officer/escalation routing configuration | automatic assignment and audited manual reassignment are implemented; routing targets/escalation configuration are incomplete | this file, §3.2 |
| DBT-specific beneficiary/NPCI workflow | not implemented; existing compensation payment simulator is not a DBT module | this file, §3.5 |
| Official administrative boundaries and live Bhuvan imagery | not verified or populated; OSM fallback works | this file, §3.7 |
| NLAMS progress export (CSV/PDF) | not implemented; table only | this file, §3.4 |
| Push/WebSocket dashboard updates | not implemented; 30 s polling only | this file, §3.4 |
| E-mail/SMS notification channels | not implemented (out of scope) | this file, §3.6 |
| Automatic SLA scheduler in the demo | disabled by default; manual scan works | this file, §3.6 |
| Real payment rails / PFMS / DBT | explicitly out of scope; SIMULATED only | this file, §3.5 |

This readiness record describes demonstrated scope rather than declaring the larger requested NLAMS acceptance list complete. Items not listed as REAL above remain partial or unimplemented.

---

## 5. Demo data and safety

- `scripts/full-demo.ps1` and `scripts/demo-seed-real.ps1` create synthetic Maharashtra place names with invented parcels, owners, amounts and geometry. Every label carries `DEMO`.
- `scripts/reset-demo-db.ps1` recreates a **separate** `landnexus_demo` database. The runbook uses `landnexus_demo`, never `landnexus_dev`.
- No passwords are written into the repository. The seed prints the generated demo password to the console only.
- Landowner data is sensitive in production; only synthetic DEMO data is used here.
- Audit and history tables are append-only. Re-running the seed adds new rows with a new random suffix instead of deleting history.

---

## 6. Stop rule

If a demo item cannot be completed before the 4-hour cut-off, stop adding features, keep the item unlinked, and record it in this file. Do not refactor, rename or add runtime dependencies to make a demo pass.

---

## 7. Re-running database verification safely

```powershell
# Create a NEW, explicitly disposable database only if one is not already available.
# Never drop/reset a shared or developer database.
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
psql -U postgres -h localhost -c "CREATE DATABASE landnexus_test_new;"

# 2. integration tests against the disposable database
cd D:\landnexus-platform\landnexus-backend
$env:LANDNEXUS_TEST_DB_URL = "jdbc:postgresql://localhost:5432/landnexus_test_new"
$env:LANDNEXUS_TEST_DB_USERNAME = "postgres"
$env:LANDNEXUS_TEST_DB_PASSWORD = "<password>"
.\mvnw.cmd clean verify

# 3. Flyway application check (fresh demo database)
psql -U postgres -h localhost -d landnexus_demo -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

Expected: `BUILD SUCCESS`, with successful migrations through V25 on the latest disposable test DB. The latest full-suite run passed after V24/V25 and dashboard changes.

---

## 8. Latest six-requirement continuation

| Requirement | Status | Implemented / verified | Still outstanding |
|---|---|---|---|
| Database-driven analytics | **PARTIAL** | Main dashboard now supports backend-validated project/taluka/date filters and database-backed GIS conflicts, pending tasks, escalation levels and permission-gated officer workload; selected filtered values matched direct SQL. All dashboard aggregates remain PostgreSQL-derived. | PFMS/DBT cannot be separated without a payment-rail field. District comparison and trend do not narrow with these filters; dashboard status filtering and exports are not implemented. |
| Scheduled SLA and escalation | **PARTIAL** | Scheduled scan was exercised against PostgreSQL: one WARNING and one BREACH persisted, and repeated scans did not create duplicates. Original rule values were restored. | Existing model supports one warning/breach pair and role targets only; named officers and configurable multilevel tiers are missing. |
| User and permission management | **PARTIAL** | Added V24 per-user permission overrides, API-backed matrix/activity-history UI, V25 access-token invalidation, and role assignment bounds. Focused database-backed auth/permission suites passed (55 tests); Users page tests passed (6). | Profile fields remain limited; activity history is a shared audit screen rather than dedicated role/permission screens, and lower geographic scopes remain unavailable. |
| Village-level geographic administration | **PARTIAL** | State → division → district → taluka → village master hierarchy exists; existing scope tests ran. | User grants and effective authorization still stop at state/division/district. |
| Routing and SLA configuration | **PARTIAL** | Existing guarded proposal routing-rule UI/API and SLA rule UI/API are wired to backend mutations; manual proposal reassignment remains separately audited. | Named officer routing, workload/availability conditions, multilevel escalation targets, and all requested configuration history/validation are not complete. |
| Linked Maharashtra demo dataset | **PARTIAL** | Two full-demo runs each passed 193/193 checks. Measured counts: 13 users, 4 proposals, 2 projects, 2 acquisition cases, 6 parcels, 4 compensation payments, 2 R&R cases. All 6 current boundaries were valid; selected FK orphan checks returned 0. | The seed is not a complete fixed-key idempotent dataset and does not provide distinct DBT/PFMS flows or full admin/routing configuration records. |

### Changes and new contracts in this continuation

- `V23__report_filter_dimensions.sql` adds project/date/taluka filter columns to `rpt_projects`, `rpt_cases` and `rpt_compensation`, preserving the existing report columns first.
- `GET /api/v1/monitoring/reports/{code}` and its CSV export accept `talukaId`, `projectId`, `fromDate` and `toDate` in addition to the existing scope/status filters. Values are bound parameters; report definitions supply the fixed SQL column names.
- `PUT /api/v1/administration/users/{id}` updates email/full name under `USER_WRITE`, rejects duplicate email and unauthorized changes to SUPER_ADMIN accounts, and audits the mutation.
- `/monitoring/reports` now offers available project/taluka choices only when the corresponding project/master-data permissions permit those lookup APIs.

The six requirements remain partial. No live external service is claimed; database evidence is limited to the exact migrations, counts, SQL comparisons, seed checks and scheduled events recorded above.
