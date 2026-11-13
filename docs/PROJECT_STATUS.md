# LandNexus - Project Status

**Last updated:** 13 November 2026
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
| `npm run test -- --run src/features/notifications src/app` | `LandNexus-frontend` | 3 files, 25 tests passed | 13 Nov 2026 |
| `npm run test -- --run src/hooks/useVisibilityPolling.test.tsx src/features/monitoring` | `LandNexus-frontend` | 2 files, 26 tests passed | 13 Nov 2026 |
| `npm run test -- --run src/features/proposals/ActionBar.test.tsx` | `LandNexus-frontend` | 1 file, 8 tests passed | 13 Nov 2026 |
| `.\mvnw.cmd "-Dtest=ProposalWorkflowTest,ProposalServiceTest" test` | `landnexus-backend` | BUILD SUCCESS, 55 tests, 0 failures | 13 Nov 2026 |
| `npm run build` (`tsc -b && vite build`) | `LandNexus-frontend` | exit 0, production bundle emitted | 13 Nov 2026 (run after each fix) |
| `npm run test` (full frontend suite) | `LandNexus-frontend` | 42 files, 201 tests passed, 119.96 s | 12 Nov 2026 |
| `.\mvnw.cmd -q -DskipTests test-compile` | `landnexus-backend` | exit 0 | 12 Nov 2026 |

**Not run, and therefore not claimed:**

- `.\mvnw.cmd clean verify` against a live PostgreSQL/PostGIS database. The database-backed
  integration tests (`*IntegrationTest`, `AbstractIsolatedPgIntegrationTest`) need working
  `DB_*` credentials and a running PostgreSQL 18 + PostGIS instance. They were compiled but
  not executed in this session.
- A fresh Flyway migration run against an empty database from V1 to V18.
- The PowerShell demo scripts (`scripts/full-demo.ps1`, `scripts/demo-seed*.ps1`). They need
  the same database and a running backend.
- The full backend test count after this session's changes. Only the two targeted classes
  above were executed.

Where this file says "tested", it means an automated test exists and the named command was
run. It does not mean the whole system was re-verified end to end.

---

## 2. Module status at a glance

Backend modules live under `landnexus-backend/src/main/java/com/landnexus/`:
`administration`, `projects`, `landrecords`, `acquisition`, `compensation`, `gis`, `reporting`, `shared`.
Flyway migrations V1-V18 live in `landnexus-backend/src/main/resources/db/migration/`.
The frontend has 14 feature folders under `LandNexus-frontend/src/features/` and 45 test files.

| # | Area | Status | Evidence in the repository |
|---|---|---|---|
| 1 | Administration and security | Built | Master data, JWT login + refresh rotation, users, roles, permissions, geographic scope, append-only audit, login history, password change/reset, IP rate limiting; V1-V4, V15 |
| 2 | Proposals, projects and routing | Built | Proposal workflow engine, scrutiny, clarification/resubmission, versions, maker-checker approval, automatic project creation, `REOPEN`, routing rules and assignments, notifications; V5, V17 |
| 3 | Land records and documents | Built | Parcels, landowners (masked, audited), ownership shares capped at 100%, mutations, 7/12 and 8A records, secure documents with versions and maker-checker verification; V6, V7 |
| 4 | Land acquisition | Built | Cases initiated automatically for approved projects, surveys, notices, objections, awards, possession; V8, V9, V16 |
| 5 | Valuation and compensation | Built | Rate cards, rule sets, estimates, simulated payments, R&R benefits; V10, V11 |
| 6 | GIS | Built (entered geometry only) | PostGIS geometry, alignments, boundary/conflict reports, imagery status; V12 |
| 7 | Monitoring, MIS and SLA | Built | NLAMS progress, portfolio/district dashboards, MIS reports and CSV export, SLA rules and escalation; V13, V14, V18 |
| - | React frontend | Built | Feature screens for all of the above, MSW-backed tests, 45 test files |

The backend has 32 controllers and 75 `*Test.java` classes. The frontend has 45 test files.
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
| `routing-rules` | Routing-rule administration UI | Rules are seeded and applied by the backend, but there is no screen to create or retire them |
| `email-sms` | E-mail and SMS delivery | Only in-app notifications exist; no provider, template or delivery record |
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
2. Add external notification delivery (e-mail/SMS) with provider adapters, delivery records,
   retries and audit, while keeping the existing in-app notifications working.
3. Add routing-rule administration and manual assignment from the UI.
4. Harden documents: antivirus scan, encryption at rest, retention and legal-hold policy.
5. Decide on and document a production deployment target (there is no Dockerfile or compose
   file in the repository today).
6. Refresh `docs/REQUIREMENTS_TRACEABILITY.md` or mark it clearly as superseded.
