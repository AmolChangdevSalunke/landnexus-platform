# Phase 1 Completion Report — Stabilise the Critical Path

**Date:** 15 November 2026  
**Status:** **COMPLETE** for the scope below  
**Verification:** full backend suite, full frontend suite and frontend production build were run after the changes; exact counts are in `docs/TESTING_AND_VERIFICATION.md`.

---

## 1. Objective

Phase 1 made the existing prototype demonstrable on its critical path:

- proposal creation → submission → scrutiny routing → recommendation → approval;
- automatic project creation and acquisition-case initiation;
- project correction/closure without bypassing the proposal record;
- secure document upload, download and preview;
- a working password-reset screen;
- a reliable test baseline against a disposable PostgreSQL database.

No module was rebuilt. Existing working functionality and API shapes were preserved except for additive endpoints and fields.

---

## 2. Defects fixed

### 2.1 Proposal submission never committed (P0)

**Symptom:** submitting a proposal failed; no `proposal_number` was allocated.

**Cause:** `ProposalService` carried a class-level `@Transactional(readOnly = true)`. The submit path therefore ran inside a read-only transaction even though it writes the number, status, history and version.

**Fix:** removed the class-level read-only annotation. Each public operation now declares its own transaction boundary. The approval orchestration remains deliberately non-transactional and uses an attempt transaction plus a fresh recovery read after rollback; it never queries after an aborted PostgreSQL transaction.

### 2.2 `start-scrutiny` conflict on reassignment

**Symptom:** `409 Conflict` when scrutiny was started by a different officer than the one currently assigned.

**Cause:** the closing assignment was updated but not flushed before the replacement row was inserted, so the partial unique index `uq_assignment_open_stage` still saw two open rows.

**Fix:** `ProposalRoutingService.startScrutiny` now calls `saveAndFlush` on the closing assignment before inserting the replacement.

### 2.3 Integration-test cleanup and stale fixtures

- Proposal integration tests deleted `proposals` before `proposal_assignments`; cleanup now removes assignments first.
- Actor fixtures were updated for the four-argument `CurrentActor` shape and for deterministic routing (`dual` is selected before `officer`).
- The routing unit test now verifies the real sequence: `saveAndFlush(open)` followed by two `save` calls.

These were test corrections, not weakened assertions.

---

## 3. Features delivered

### 3.1 Project edit, close and reopen

- New migration `V20__project_management.sql`:
  - adds `PROJECT_MANAGE`;
  - grants it to `SUPER_ADMIN`, `CENTRAL_ADMIN`, `STATE_ADMIN`, `DIVISION_ADMIN` and `DISTRICT_ADMIN`;
  - adds `NOT VALID` check constraints for non-blank title and positive area/length.
  - no existing row is deleted or updated.
- New protected endpoints:
  - `PUT /api/v1/projects/{id}`;
  - `POST /api/v1/projects/{id}/close`;
  - `POST /api/v1/projects/{id}/reopen`.
- Edits are transactional and audited. Immutable fields (code, proposal, owner, approval metadata) are preserved. A closed project is read-only until reopened.
- Access still requires the existing proposal visibility/geographic scope in addition to `PROJECT_MANAGE`.
- Frontend: `/projects/:id/edit`, `ProjectEditPage`, and Edit/Close/Reopen actions with confirmation and toasts on the details page.

### 3.2 Document preview

- New endpoint `GET /api/v1/land-records/documents/{id}/versions/{versionNo}/preview`.
- Requires `DOCUMENT_READ`, applies the same document visibility check, and records a `PREVIEW` audit event.
- Serves only `application/pdf`, `image/jpeg` and `image/png` inline. Other stored types are refused rather than served inline.
- Shared response helper gives preview and download identical security headers: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, and an explicit disposition.
- Frontend fetches the preview through the authenticated client, renders a short-lived object URL, and revokes it when the dialog closes. Preview buttons were added to the document details page and parcel documents tab.

### 3.3 Forgot password

- The reset screen now calls the existing public `POST /api/v1/auth/reset-password`.
- The screen validates code/password/confirmation, displays backend failures, and shows a success state.
- Reset codes remain an administrator-issued, one-time secret. The public screen neither issues nor reveals them.

---

## 4. Database and security impact

### Database

- Only one new migration: `V20__project_management.sql`.
- No applied migration was edited.
- No destructive statement, reset, recreate or data deletion was performed.
- Integration tests use the disposable `landnexus_it_verify` database through `LANDNEXUS_TEST_DB_*`; guards fail fast if `landnexus_dev` is targeted.

### Security

- New project operations require `PROJECT_MANAGE` **and** existing visibility/scope checks.
- Document preview requires `DOCUMENT_READ`, enforces the same scope rule as metadata/download, is audited, and refuses non-previewable types.
- Preview is a blob fetch in the browser, not an unauthenticated link.
- Frontend permission checks remain usability aids, not the security boundary.

---

## 5. Verification summary

| Check | Result |
|---|---|
| Full backend suite (`.\mvnw.cmd test`, disposable PostgreSQL) | See `docs/TESTING_AND_VERIFICATION.md` for exact counts. |
| Focused document tests | `DocumentServiceTest`: 17 tests, 0 failures. |
| Focused frontend document tests | `DocumentDetailsPage.test.tsx` + `DocumentsTab.test.tsx`: 8 tests passed. |
| Full frontend suite | 47 files, 240 tests passed. |
| Frontend production build (`npm run build`) | See `docs/TESTING_AND_VERIFICATION.md`. |

The verification record is authoritative. This report does not claim a run that did not happen.

---

## 6. Deferred items

| Item | Reason | Target |
|---|---|---|
| BUG-008 role/permission administration | Administrative capability; read-only matrix remains correct and safe | Phase 2 |
| BUG-009 routing-rule administration / manual reassignment | Administrative capability; seeded rules still execute correctly | Phase 2 |
| Notification preference UI and tested provider integration | Needs product decisions and provider credentials | Phase 2/3 |
| Malware scanning, encryption at rest, access-token revocation | Hardening, not a Phase 1 blocker | Phase 3 |
| Government integrations | Explicitly out of Phase 1; see `docs/GOVERNMENT_INTEGRATION_STATUS.md` | Phase 3 |

---

## 7. Phase 1 exit criteria

- [x] Proposal submission commits and allocates its number.
- [x] Scrutiny reassignment no longer violates the open-stage unique index.
- [x] Project details can be corrected, closed and reopened by authorised administrators only.
- [x] Documents can be previewed safely without bypassing authentication.
- [x] Forgot-password screen uses the real reset endpoint.
- [x] Full backend and frontend suites were re-run after the changes.
- [x] No destructive database action, commit or push was performed.
- [x] Deferred items are recorded in `docs/KNOWN_ISSUES.md`.
