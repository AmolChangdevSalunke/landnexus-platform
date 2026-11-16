# LandNexus - Project Status

**Last updated:** 15 November 2026
**Scope of this file:** what exists in this repository now, what was actually run to prove it, and what is still missing.
**Companion files:** `README.md` (one-page summary), `docs/SETUP_AND_RUN.md` (how to run), `docs/IMPLEMENTATION_CHANGELOG.md` (history).

This file replaces an earlier status page (dated 2026-11-06) that said Modules 4-7 and the
React frontend were "not built yet". That was true in early November and is no longer true.
The code, migrations and routes below exist in this working tree and are exercised by the
test suites named here.

---

## 1. Verification actually performed

| Command | Working directory | Result | Date |
|---|---|---|---|
| `.\mvnw.cmd test` (disposable `landnexus_nlams_test_20261115`) | `landnexus-backend` | **573 tests, 0 failures, 0 errors, 0 skipped**; migrations through V23 | 15 Nov 2026 |
| `npm test` (full suite) | `LandNexus-frontend` | **50 files, 250 tests passed** | 15 Nov 2026 |
| `npm run build` (`tsc -b && vite build`) | `LandNexus-frontend` | exit 0, production bundle built (chunk-size warning only) | 15 Nov 2026 |
| `scripts/full-demo.ps1` (two runs) | repository root, disposable backend | Each run: **193 checks passed, 0 failed** | 15 Nov 2026 |
| Dashboard/MIS response comparison with direct SQL | disposable PostgreSQL/PostGIS | Proposals 4/4, projects 2/2, active parcels 6/6, acquisition cases 2/2; filtered report 1/1 | 15 Nov 2026 |
| Scheduled SLA integration exercise | scheduler-enabled backend, disposable database | One WARNING and one BREACH persisted; repeated scans left scheduler-triggered count at 2 | 15 Nov 2026 |
| Demo data integrity queries | read-only `psql` queries | 13 users, 4 proposals, 2 projects, 2 cases, 6 parcels, 4 compensation payments, 2 R&R cases; 6/6 boundaries valid; selected orphan checks 0 | 15 Nov 2026 |
| `.\mvnw.cmd -q -Dtest=DocumentServiceTest test` | `landnexus-backend` | 17 tests, 0 failures | 15 Nov 2026 |
| `npm test -- --run src/features/landRecords/DocumentDetailsPage.test.tsx src/features/landRecords/DocumentsTab.test.tsx` | `LandNexus-frontend` | 2 files, 8 tests passed | 15 Nov 2026 |
| `npm run test -- --run src/features/notifications src/app` | `LandNexus-frontend` | 3 files, 25 tests passed | 13 Nov 2026 |
| `npm run test -- --run src/hooks/useVisibilityPolling.test.tsx src/features/monitoring` | `LandNexus-frontend` | 2 files, 26 tests passed | 13 Nov 2026 |
| `npm run test -- --run src/features/proposals/ActionBar.test.tsx` | `LandNexus-frontend` | 1 file, 8 tests passed | 13 Nov 2026 |
| `.\mvnw.cmd "-Dtest=ProposalWorkflowTest,ProposalServiceTest" test` | `landnexus-backend` | BUILD SUCCESS, 55 tests, 0 failures | 13 Nov 2026 |
| `.\mvnw.cmd "-Dtest=ContactMaskerTest,NotificationTemplateServiceTest,NotificationOutboxTest,NotificationDeliveryAttemptServiceTest,NotificationDeliveryServiceTest,HttpNotificationAdapterTest,UserNotificationRecipientDirectoryTest,NotificationServiceTest" test` | `landnexus-backend` | BUILD SUCCESS, 38 tests, 0 failures | 14 Nov 2026 |
| `.\mvnw.cmd -q -DskipTests test-compile` | `landnexus-backend` | exit 0 | 14 Nov 2026 |
| `npm run test -- --run src/app` | `LandNexus-frontend` | 1 file, 4 tests passed | 14 Nov 2026 |
| `npm run build` (`tsc -b && vite build`) | `LandNexus-frontend` | exit 0, production bundle emitted | 14 Nov 2026 |
| `npm run test` (full frontend suite) | `LandNexus-frontend` | 42 files, 201 tests passed, 119.96 s | 12 Nov 2026 |
| `.\mvnw.cmd "-Dtest=AcquisitionServicesTest,ProposalApprovedCaseInitiatorTest,ProposalServiceTest" test` | `landnexus-backend` | BUILD SUCCESS, 25 + 3 + 45 tests, 0 failures | 14 Nov 2026 |
| `psql -f db/reconciliation/reconcile_duplicate_acquisition_cases.sql` | `landnexus-backend` | 15 redundant INITIATED cases merged into 11 CLOSED cases; postconditions passed | 14 Nov 2026 |
| Flyway V16-V19 against `landnexus_dev` | `landnexus-backend` | `flyway_schema_history` success through version 19; `uq_acquisition_cases_project` present | 14 Nov 2026 |
| `.\mvnw.cmd spring-boot:run` (DB_URL/DB_PASSWORD/JWT_SECRET from the environment) | `landnexus-backend` | Flyway validated 19 migrations, `Schema "public" is up to date`, application started | 14 Nov 2026 |
| `.\mvnw.cmd "-Dtest=AcquisitionIntegrationTest" test` (disposable `landnexus_it_verify`) | `landnexus-backend` | 19 migrations applied from V1, 2 tests passed, 0 failures | 14 Nov 2026 |

**Not run, and therefore not claimed:**

- `.\mvnw.cmd clean verify`. The full `test` suite was run against the disposable
  `landnexus_nlams_test_20261115` database, but `clean verify` was not.
- Docker/Testcontainers concurrency verification. Docker is not available in this environment.
- `scripts/demo-seed*.ps1` as standalone scripts. `scripts/full-demo.ps1` did run twice against
  the isolated backend; each execution passed 193 checks.
- Real e-mail/SMS provider delivery and any government integration. None is configured.

Where this file says "tested", it means an automated test exists and the named command was
run. It does not mean every demo path was clicked end to end. The authoritative command record
is `docs/TESTING_AND_VERIFICATION.md`.

---

## 2. Module status at a glance

Backend modules live under `landnexus-backend/src/main/java/com/landnexus/`:
`administration`, `projects`, `landrecords`, `acquisition`, `compensation`, `gis`, `reporting`, `shared`.
Flyway migrations V1-V23 live in `landnexus-backend/src/main/resources/db/migration/`.
The frontend has 14 feature folders under `LandNexus-frontend/src/features/` and 50 test files.

| # | Area | Status | Evidence in the repository |
|---|---|---|---|
| 1 | Administration and security | Built | Master data, JWT login + refresh rotation, users, roles, permissions, geographic scope, append-only audit, login history, password change/reset, IP rate limiting; V1-V4, V15 |
| 2 | Proposals, projects and routing | Built | Proposal workflow engine, scrutiny, clarification/resubmission, versions, maker-checker approval, automatic project creation, `REOPEN`, routing rules and assignments, project edit/close/reopen with `PROJECT_MANAGE`, notifications; V5, V17, V20 |
| 3 | Land records and documents | Built | Parcels, landowners (masked, audited), ownership shares capped at 100%, mutations, 7/12 and 8A records, secure documents with versions, maker-checker verification and audited inline preview; V6, V7 |
| 4 | Land acquisition | Built | Cases initiated automatically for approved projects, surveys, notices, objections, awards, possession; V8, V9, V16 |
| 5 | Valuation and compensation | Built | Rate cards, rule sets, estimates, simulated payments, R&R benefits; V10, V11 |
| 6 | GIS | Built (entered geometry only) | PostGIS geometry, alignments, boundary/conflict reports, imagery status; V12 |
| 7 | Monitoring, MIS and SLA | Built | NLAMS progress, portfolio/district dashboards, MIS reports and CSV export, SLA rules and escalation; V13, V14, V18 |
| 8 | External notifications | Built, off by default | E-mail/SMS channel adapters (`none`, `log`, `http`), transactional outbox, delivery records, bounded retries with backoff, masked contacts, admin delivery/retry API; V19 |
| - | React frontend | Built | Feature screens for all of the above, MSW-backed tests, 50 test files |

The backend has 33 controllers and 83 `*Test.java` classes. The frontend has 50 test files.
Those counts are structural facts, not a pass result.

### 2.1 What each area actually does

- **Administration:** states, divisions, districts, talukas, villages, departments, ministries
  and roles; scoped user administration; `AUDIT_READ`-guarded audit trail; self-service
  password change and reset codes; login throttling. Access tokens are short-lived JWTs with
  refresh-token rotation.
- **Proposals:** `DRAFT -> SUBMITTED -> UNDER_SCRUTINY -> RECOMMENDED -> APPROVED`, with
  clarification and rejection branches. Rejection requires a reason. A rejected proposal can
  be reopened to `DRAFT` by its owner (with a reason); it keeps its number, versions and
  history, and never creates a second project. Approval creates the project and acquisition
  case. Routing rules and stage assignments drive the scrutiny/decision queues.
- **Land records:** parcels and landowners with restricted personal data, ownership shares,
  mutations, 7/12 and 8A revenue records, and a document register with validation, versions
  and audits.
- **Acquisition:** the case lifecycle from survey through notices, objections, award and
  possession, with stage tracking and printable notice/award letters.
- **Compensation:** rate cards and rule sets produce estimates; payments are recorded as
  **SIMULATED**; R&R benefits are tracked per family.
- **GIS:** officer-entered GeoJSON geometry, PostGIS storage, conflict detection against
  parcels, and an imagery status screen that reports configuration honestly. There is no
  satellite tile service or Bhuvan integration.
- **Monitoring:** NLAMS progress uses a transparent five-milestone formula (20% each: case,
  parcels, notification, award, possession). Dashboards refresh on a visibility-aware 30-second
  poll and show the last update time. Reports export CSV. The SLA scheduler is **off by
  default** (`LANDNEXUS_SLA_SCHEDULER=true` enables it); the manual scan always works.

### 2.2 External notification delivery (e-mail and SMS)

In-app notifications are unchanged and are always written. After a notification is saved,
`NotificationService` asks `NotificationOutbox` to enqueue external delivery rows **in the same
transaction**. Enqueueing only inserts rows; no provider call happens during approval or any
other business transaction, so a slow or failing provider cannot block or roll back the
business change. If the transaction rolls back, no delivery row survives.

- **Channels and providers:** `EMAIL` and `SMS` are opt-in. Each channel is configured with
  `LANDNEXUS_NOTIFICATIONS_EMAIL_PROVIDER` / `LANDNEXUS_NOTIFICATIONS_SMS_PROVIDER` as
  `none` (default), `log` (development, writes to the application log, no network call) or
  `http` (posts provider-neutral JSON to a configured webhook with an optional bearer token).
  An unknown provider name fails at startup rather than silently dropping messages.
- **Delivery records:** `notification_deliveries` is a transactional outbox with one row per
  notification and channel, status `PENDING`, `SENT`, `FAILED` or `RETRY`, attempt count,
  next-attempt time, provider name and a safe error. A unique `(notification_id, channel)`
  constraint and a row lock before each send prevent duplicate delivery.
- **Retries:** provider failures are retried with exponential backoff up to a configurable
  maximum (`LANDNEXUS_NOTIFICATIONS_MAX_ATTEMPTS`, default 5), capped by
  `_MAX_BACKOFF_MS`. Exhausted rows become `FAILED` and an administrator can requeue one with
  a fresh budget.
- **Contacts and privacy:** delivery rows store only a masked destination
  (`j***e@example.com`, `******3210`); the real address is resolved again at send time.
  `notification_contacts` holds optional per-user e-mail/phone and channel preferences.
  Without a contact row, e-mail falls back to the address on `users` and SMS stays disabled.
  Audit events contain the masked destination, never the raw contact.
- **Administrator API:** `GET /api/v1/notifications/deliveries`,
  `GET /api/v1/notifications/deliveries/by-notification/{notificationId}` and
  `POST /api/v1/notifications/deliveries/{id}/retry`, all guarded by `SETTINGS_MANAGE`.
- **Still missing:** there is no screen or public API to edit contacts/preferences and no
  delivery console in the frontend; the generic `http` webhook is the only real provider
  adapter (no vendor-specific e-mail/SMS client); and bounces and complaints are not processed.
  V19 has been applied to `landnexus_dev` and the backend starts against it, but no live
  provider has been configured, so no outbound message has been delivered end to end.

---

## 3. Roadmap alignment

The "My work" page now separates live capabilities from genuinely missing ones
(`LandNexus-frontend/src/app/roadmapModules.ts`).

### 3.1 Implemented modules with real links

| Module | Route |
|---|---|
| Proposals and approval | `/proposals` |
| Government projects | `/projects` |
| Acquisition lifecycle | `/acquisition` |
| Valuation and compensation | `/monitoring/compensation` |
| GIS and land records | `/gis` |
| Document register | `/land/documents` |
| Monitoring and MIS | `/monitoring` |
| Notifications and alerts | `/notifications` |

Old roadmap links redirect: `/roadmap/valuation-compensation` -> `/monitoring/compensation`,
`/roadmap/monitoring-mis` -> `/monitoring/reports`, `/roadmap/gis` -> `/gis`.

### 3.2 Capabilities that are still genuinely missing (shown as Planned)

| Key | Capability | Why it is not "done" |
|---|---|---|
| `routing-rules` | Named officer/workload routing administration | Existing rule UI/API supports proposal/project type and area thresholds; named officer, availability and workload conditions are not supported |
| `role-permissions` | Per-user module permissions and permission history | Role permission updates are available through a guarded matrix/API; a per-user module-permission matrix and dedicated role/permission history screens are not implemented |
| `notification-settings` | Notification preferences and delivery console | External delivery, provider adapters and delivery records exist, but there is no self-service preference screen, contact editor or admin delivery console in the frontend |
| `pfms-dbt` | PFMS/DBT disbursement | Payments are simulated; there is no bank or government payment rail |
| `isro-bhuvan` | ISRO Bhuvan imagery | No WMS/WMTS connection or licensed imagery |
| `bhunaksha` | BhuNaksha cadastral import | No external cadastral service connection |
| `external-land-records` | External 7/12, 8A and Ferfar services | Records are entered/handled in-app; there is no state-system exchange |
| `document-security` | Antivirus and document encryption | Uploads are type/size validated only; no scanner, encryption at rest or key rotation |

These are external integrations or hardening work, not hidden "implemented but unlinked"
features. Nothing in the frontend invents data for them.

---

## 4. Honest limitations and known risks

- **No real integrations.** Payments, satellite imagery, cadastral maps, revenue-record
  exchange and PFMS/DBT are simulated or absent. All demo data is synthetic and labelled
  `DEMO`. Do not load real personal or land data.
- **Documents are not virus-scanned and not encrypted at rest.** They are stored outside the
  project with random names. Antivirus/encryption is a roadmap item.
- **External delivery is opt-in and unproven against a real provider.** The default provider is
  `none`, so no e-mail or SMS leaves the machine. `log` is for development. `http` is a generic
  webhook, not a tested integration with a specific e-mail or SMS vendor. The V19 schema is
  applied to `landnexus_dev`, but no provider has been configured or exercised end to end.
- **No notification preference UI.** Contacts and channel preferences can only be set by
  writing to `notification_contacts`; there is no API or screen for users or administrators.
- **Access tokens remain valid for their short lifetime after a user is disabled.** Disabling
  a user does not revoke an already-issued access token before it expires.
- **SLA escalation is opt-in.** With the default configuration the scheduled scan does not
  run; only a manual scan does.
- **`spring.jpa.show-sql=true`** is on for development. Turn it off before any shared demo.
- **The local DB password must be changed** before any demo or shared environment.
- **Nothing has been pushed to GitHub** as of this commit.
- **`docs/REQUIREMENTS_TRACEABILITY.md` is an older read-only snapshot (2026-11-06, revision
  `e3a62f1`).** Its "not implemented" rows for Modules 3-7 and the frontend are out of date.
  Use this file for current status; use the traceability audit only for its method and
  requirement wording.
- **`docs/FRONTEND_BUILD_PROMPT.md.backup*`** are historical backups. They are kept for
  reference and are not current contract documents.

---

## 5. Documentation tree: duplicates and clutter found

No files were deleted or moved during this review. The findings below are recorded so the
owner can decide what to remove.

| Path | Finding |
|---|---|
| `scripts/README.md` | Byte-identical to the root `README.md` (SHA256 `A1B7CEF4...64EA1B8`); stale duplicate |
| `scripts/.env.example` | Byte-identical to the root `.env.example` (SHA256 `F4CED0FF...B401FACE`); stale duplicate |
| `docs/docs/IMAGERY_SETUP.md` | Unique file in a redundant nested `docs/docs/` folder; content is not duplicated elsewhere |
| `docs/scripts/demo-seed.ps1` | 0-byte empty file in a redundant nested `docs/scripts/` folder; the real script is `scripts/demo-seed.ps1` (14,824 bytes) |
| `docs/FRONTEND_BUILD_PROMPT.md.backup` | Historical backup, not identical to the current prompt |
| `docs/FRONTEND_BUILD_PROMPT.md.backup-2026-11-06` | Historical backup, not identical to the current prompt |
| `docs/DEMO_READINESS.md`, `docs/DEMO_RUNBOOK.md` | Current, useful demo notes; untracked in this working tree |
| `docs/IMPLEMENTATION_CHANGELOG.md` | Long historical log; useful, not a status source |

`.idea/` ignore files are also duplicated between the repository root and
`landnexus-backend/.idea/`. They are IDE metadata and not part of the application.

---

## 6. Suggested next tasks

1. Run the full backend `clean verify` and the PowerShell end-to-end demo against a real
   PostgreSQL/PostGIS instance, and record the results here.
2. Add the notification preferences screen, contact verification/opt-out and an administrator
   delivery console on top of the existing `/api/v1/notifications/deliveries` API, then connect
   one real e-mail and SMS provider behind the generic `http` adapter.
3. Add routing-rule administration and manual assignment from the UI.
4. Harden documents: antivirus scan, encryption at rest, retention and legal-hold policy.
5. Decide on and document a production deployment target (there is no Dockerfile or compose
   file in the repository today).
6. Refresh `docs/REQUIREMENTS_TRACEABILITY.md` or mark it clearly as superseded.
