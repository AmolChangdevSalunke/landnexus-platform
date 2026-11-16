# 6. Bugs & Technical Issues — LandNexus / NLAMS

**Audit date:** 14 November 2026 · **Type:** read-only defect audit
**Reference command results:** backend `mvnw test` → 542 tests, 519 pass, 14 failures, 3 errors, **BUILD FAILURE**; frontend `npm run test` → 45 files / 233 tests **pass**; frontend `npm run build` → **pass** (24.22 s).
**No source file was modified.** Fixes below are recommendations only.

Severity: **P0** release blocker · **P1** high (correctness/security/operability) · **P2** medium · **P3** low.

---

## 1. Bug register

| ID | Severity | Title | Area | Evidence | Status |
|---|---|---|---|---|---|
| BUG-001 | **P0** | Proposal workflow fails at runtime: write statements inside a read-only transaction | Backend / Proposals | 14 × `ERROR: cannot execute nextval() in a read-only transaction`; `ProposalWorkflowIntegrationTest` 6 failures + 3 errors | Open |
| BUG-002 | P1 | Integration fixture creates a department without required `ministryId`/`level` → HTTP 400 | Tests | `ProposalApprovalReliabilityIntegrationTest.setUp:88`; `expected:<201> but was:<400>`; 6/6 fail | Open |
| BUG-003 | P1 | Integration cleanup deletes from tables that no longer exist | Tests | `relation "parcel_owners" does not exist`; stale `affected_parcels`; suppressed on every failing test | Open |
| BUG-004 | P1 | Password policy test asserts a rejection the policy correctly does not make | Tests | `PasswordIntegrationTest:125` expected 400, got 204 for `prefix + "Aa1"` | Open (test defect) |
| BUG-005 | P1 | Backend test suite is red; no build gate | Delivery | `BUILD FAILURE`, 542 tests, 17 non-passing | Open |
| BUG-006 | P1 | Forgot-password page says the feature is unavailable while backend supports it | Frontend / Auth | `features/auth/ForgotPasswordPage.tsx` “Password reset is not available yet”; `POST /api/v1/auth/reset-password` exists | Open |
| BUG-007 | P1 | Projects cannot be edited or closed | Backend / Projects | `ProjectService` only `get`/`list`; `projects.status` allows `CLOSED` but no endpoint | Open |
| BUG-008 | P1 | Roles and their permissions cannot be administered | Backend / Admin | `RoleController` has only `GET`; `RolesPage.tsx` read-only; `V3` seed is the only source | Open |
| BUG-009 | P1 | Routing rules are seeded but not manageable | Backend / Proposals | `routing_rules` (V17); `ProposalRoutingService`; `ROUTING_RULE_MANAGE` permission with no endpoint | Open |
| BUG-010 | P1 | Notification contact data and preferences are unreachable | Backend / Notifications | `notification_contacts` (V19); only `NotificationContactRepository` references it | Open |
| BUG-011 | P1 | Recorded parcel area is not reconciled with PostGIS geometry area | Data | `land_parcels.area_ha` manual vs `parcel_boundaries.area_ha` computed | Open |
| BUG-012 | P1 | No malware scanning, encryption or retention for documents | Security / Documents | `FileValidator` comment “No virus scanner in this prototype”; `LocalFileStorage` plain files | Open |
| BUG-013 | P1 | No CI pipeline; regressions reach `main` unseen | Delivery | no `.github/workflows`, no pipeline config | Open |
| BUG-014 | P2 | Frontend main bundle is 944.34 kB | Frontend / Perf | `dist/assets/index-CGN30cyA.js`; Vite chunk-size warning | Open |
| BUG-015 | P2 | Access token remains valid after logout until expiry | Security | refresh family ended; no access-token denylist | Open |
| BUG-016 | P2 | Rate limiting is in-memory, per node | Security / Ops | `shared/security` limiter; no shared store | Open |
| BUG-017 | P2 | No idempotency keys on money/workflow POSTs | API | no `Idempotency-Key` handling; retries rely on state machine/unique keys | Open |
| BUG-018 | P2 | Three integration classes share one database and clean by username prefix | Tests | `AbstractIsolatedPgIntegrationTest` + `DELETE ... LIKE prefix%` | Open (flakiness risk) |
| BUG-019 | P2 | Print/export of notices and awards is browser-only | Backend / Acquisition | print pages render HTML; no server PDF/DSC | Open |
| BUG-020 | P2 | No manual SLA scan from the UI | Frontend / Monitoring | `SlaMonitoringPage` reads escalations; scan is scheduler-only | Open |
| BUG-021 | P2 | Uncommitted working-tree changes weaken reproducibility | Delivery | `AssignmentDtos.java` modified (unused `ReassignRequest` removed), `application.properties` line-ending diff, untracked `docs/DEMO_*`, `docs/docs/`, `docs/scripts/`, `audit-reports/` | Open |
| BUG-022 | P2 | Real dev data lives only in `landnexus_dev`; demo/seed scripts are partly untracked | Data | `docs/DEMO_READINESS.md`, `docs/DEMO_RUNBOOK.md`, `docs/scripts/` untracked | Open |
| BUG-023 | P2 | Legacy prototype ships in the repository | Repo hygiene | `LandNexus-frontend/src/legacy-prototype/`; excluded from this audit | Open |
| BUG-024 | P3 | Older requirements traceability doc is stale (86 rows) | Docs | `docs/REQUIREMENTS_TRACEABILITY.md` dated 2026-11-06 | Open |
| BUG-025 | P3 | No container packaging | Ops | no `Dockerfile`/`docker-compose.yml` | Open |
| BUG-026 | P3 | No MFA/SSO | Security | no TOTP/WebAuthn/OIDC | Open |
| BUG-027 | P3 | No Swagger UI (JSON contract only) | API DX | `/api/v1/meta/openapi.json` only | Open |
| BUG-028 | P3 | No egress allowlist for outbound HTTP adapters | Security | provider URL from configuration | Open |

---

## 2. BUG-001 (P0) — proposal workflow is broken at runtime

### Symptom

Every proposal state-change endpoint returns HTTP 500. Log:

```
2026-11-14T19:41:24.218 WARN  ... org.hibernate.orm.jdbc.error : ERROR: cannot execute nextval() in a read-only transaction
JDBC exception executing SQL [ERROR: cannot execute nextval() in a read-only transaction]
   [select nextval('proposal_number_seq')]
2026-11-14T19:41:24.231 ERROR ... ApiExceptionHandler : Unexpected error on /api/v1/projects/proposals/1f95d037-.../submit
```

Occurrences: **14** in the full suite, all in `ProposalWorkflowIntegrationTest`.

Affected endpoints (`ProposalController` → `ProposalService.transition/reject`):

- `POST /api/v1/projects/proposals/{id}/submit`
- `POST /api/v1/projects/proposals/{id}/resubmit`
- `POST /api/v1/projects/proposals/{id}/reopen`
- `POST /api/v1/projects/proposals/{id}/start-scrutiny`
- `POST /api/v1/projects/proposals/{id}/request-clarification`
- `POST /api/v1/projects/proposals/{id}/recommend`
- `POST /api/v1/projects/proposals/{id}/reject`
- `POST /api/v1/projects/proposals/{id}/approve` (by inspection, see below)

### Root cause (file/line evidence)

`landnexus-backend/src/main/java/com/landnexus/projects/application/ProposalService.java`

| Line | Code | Consequence |
|---|---|---|
| 59 | `@Transactional(readOnly = true)` on the class | every public method defaults to a read-only transaction |
| 217 | `public ProposalResponse transition(...)` — **no `@Transactional`** | inherits read-only |
| 226 | `public ProposalResponse reject(...)` — **no `@Transactional`** | inherits read-only |
| 222, 234 | `return self.applyNonApproveInTransaction(...)` | `@Lazy` self-proxy call, but `@Transactional` (line 237) uses default `REQUIRED` propagation → **joins the existing read-only transaction** |
| 238 | `@Transactional public ProposalResponse applyNonApproveInTransaction(...)` | the annotation gives a false sense of a write transaction |
| 250–261 | `@Transactional approveAttemptInTransaction(...)` calls `findByIdForUpdate` | `SELECT … FOR UPDATE` is also illegal in a read-only transaction; approval is broken by inspection (not observed because the approval integration tests fail earlier at fixture setup) |
| 264 | `loadApprovedResultInFreshTransaction` is `readOnly = true` | correct for reads, but the name implies a fresh tx it does not get (no `REQUIRES_NEW`) |

The read-only transaction is opened by the CGLIB proxy when the controller calls `transition(...)`/`reject(...)`. The nested proxy call joins it because propagation is `REQUIRED`. PostgreSQL then rejects sequence use and row locks.

### Why unit tests missed it

`ProposalServiceTest` (45 tests) instantiates the service with mocks and never starts a Spring transaction/EntityManager, so no real `@Transactional` boundary exists. Only the three `AbstractIsolatedPgIntegrationTest` subclasses exercise real transactions — and all three currently fail for other reasons (BUG-002/003), so the project has **zero green end-to-end proof of the proposal workflow**.

### Impact

- Consultants cannot submit proposals.
- No proposal can be scrutinised, recommended, approved or rejected.
- Project and acquisition-case creation from approval cannot be demonstrated.
- The NLAMS dashboards/monitoring will show only pre-existing/seed data.

This invalidates the headline demo flow. Treat as release blocker.

### Recommended fix (not applied)

1. Remove class-level `readOnly = true` from `ProposalService` and annotate each read method (`get`, `list`, `history`, `versions`, `assignments`, `myTasks`, `validate`) with `@Transactional(readOnly = true)`.
2. Annotate `transition` and `reject` with `@Transactional`.
3. Either drop the `self` indirection for non-approval actions (call the private `applyInCurrentTransaction` directly) or set `@Transactional(propagation = Propagation.REQUIRES_NEW)` explicitly where a new transaction is truly required — and rename the misleading `…InFreshTransaction` methods accordingly.
4. Keep the approval-recovery design, but give `approveAttemptInTransaction` and `loadApprovedResultInFreshTransaction` explicit `REQUIRES_NEW` propagation so their names and behaviour agree.
5. Add a Spring `@SpringBootTest` slice (or reuse the isolated-PG base) that calls `POST /submit` and asserts 200 + `proposal_number != null`.

### Verification after fix

- `POST /submit` returns 200 and persists `proposal_number`.
- `ProposalWorkflowIntegrationTest` reaches its own assertions.
- Audit/history/notification rows are written in the same transaction as the state change.

---

## 3. BUG-002 / BUG-003 — integration fixtures and cleanup are stale

**BUG-002** — `ProposalApprovalReliabilityIntegrationTest.java:88`

```java
departmentId = create("/departments", "{\"code\":\"ITRD"+suffix+"\",\"name\":\"Dept "+suffix+"\"}");
```

`DepartmentRequest` requires `ministryId` and `level`; the call omits both, so the API correctly returns **400**, and the test’s `create(...)` helper fails expecting **201**. The test then fails in `setUp` before exercising approval. Six tests fail for this one fixture line.

**BUG-003** — `/api/v1/.../cleanUp` in the same class (around line 115) and in `ProposalWorkflowIntegrationTest.cleanUp` (line 118):

```sql
DELETE FROM parcel_owners WHERE parcel_id IN (SELECT id FROM affected_parcels ...)
```

The schema renamed these to `case_parcel_owners` / `case_parcels`; `parcel_owners` and `affected_parcels` do not exist. Result: `PSQLException: relation "parcel_owners" does not exist`, surfaced as suppressed failures and leaving test data behind.

Consequence: **no reliable end-to-end regression safety net** for the most critical workflow, which is exactly how BUG-001 survived.

Recommended: create the department with a ministry + level; fix cleanup to current table names; run cleanup in `finally`; prefer transactional rollback or a per-class schema/database instead of prefix deletes.

---

## 4. BUG-004 — password test expectation is wrong (test defect, product behaves correctly)

`PasswordIntegrationTest.java:125`

```java
expect(send(token, CHANGE, change(PASSWORD, prefix + "Aa1")), 400);   // "contains the user name"
```

`PasswordService.requireStrong(next, user.getUsername())` rejects a password only if it **contains the full username**. The test user’s username is `prefix + "target"`, while the candidate password is `prefix + "Aa1"` — a prefix, not the username. 204 (success) is the correct result. The test should use `prefix + "target" + "Aa1"` (or the actual username). The earlier assertion at line 122–124 already proves the length/difference checks.

Note: this is the **only** failure in an otherwise passing `AuthFlowIntegrationTest` (8/8) and `PasswordIntegrationTest` (1/2).

---

## 5. Security issues

| ID | Issue | Severity | Current state | Recommendation |
|---|---|---|---|---|
| SEC-1 | No malware scanning of uploads | HIGH | magic-byte type check only | integrate ClamAV/ICAP before commit-to-storage |
| SEC-2 | No encryption at rest for documents or PII | HIGH | plain files, plain columns | storage-level encryption + column encryption for identifiers |
| SEC-3 | Access tokens not revocable before expiry | MEDIUM | refresh family ended on logout/reuse | short TTL + denylist or token version per user |
| SEC-4 | Rate limiting is per-node, in memory | MEDIUM | single-node limiter | Redis/Bucket4j or gateway quota |
| SEC-5 | No idempotency on payment/workflow POSTs | MEDIUM | state machine + unique keys only | `Idempotency-Key` store |
| SEC-6 | No RLS / tenant isolation in DB | MEDIUM (HIGH if multi-tenant) | app-level `GeoScopeService` only | Postgres RLS policies |
| SEC-7 | No MFA/SSO for privileged roles | MEDIUM | password + lockout only | TOTP or OIDC for admins |
| SEC-8 | No egress allowlist for outbound HTTP adapters | LOW | configurable URL | host allowlist |
| SEC-9 | No request-body size cap (non-upload) | LOW | framework defaults | server-level `max-http-request-size` |
| SEC-10 | No backup/PITR runbook | MEDIUM | none in repo | documented + automated backups |

**Positive controls verified:** stateless JWT, BCrypt cost 12, 5-attempt/15-min lockout, refresh rotation with reuse detection ending all sessions, per-endpoint `@PreAuthorize`, 85 frontend permission gates, append-only audit/login/history triggers, file magic-byte validation and non-executable random `.bin` storage outside the web root, masked notification destinations, simulated payment mode enforced by a guard.

---

## 6. Performance and scalability

| Finding | Evidence | Impact |
|---|---|---|
| Main JS bundle 944 kB (gzip 245 kB) | Vite build log | slow first paint on 3G/4G government networks |
| Large per-state map chunks (up to 460 kB, `ScopeMap` 466 kB) | build log | lazy, but heavy on low-end devices |
| Reporting queries hit views without pagination for CSV (10 000-row cap) | `ReportService.MAX_EXPORT_ROWS` | export latency and memory on large states |
| History tables unpartitioned | DDL | slow audits at scale |
| Dashboard does multiple count queries per request | `DashboardService` + `DashboardRepository` | acceptable at demo scale; needs caching/materialisation later |
| No connection-pool tuning documented | Hikari defaults | may need sizing guidance for production |

---

## 7. Operability and delivery

| Finding | Evidence | Impact |
|---|---|---|
| No CI | repository | no automated gate; BUG-001/005 undetected |
| No Docker/compose | repository | environment drift; slow onboarding |
| Actuator exposes only `health,info` | `application.properties` | no metrics/tracing/alerts |
| SLA scheduler opt-in and silent when off | `LANDNEXUS_SLA_SCHEDULER` | escalations do not happen in a default deployment |
| Notification provider default `none` | `DisabledNotificationAdapter` | e-mail/SMS silently absent unless configured |
| Uncommitted changes + untracked demo docs | `git status` | another machine cannot reproduce the audited state (BUG-021/022) |
| Legacy prototype in the repo | `src/legacy-prototype` | search/scan noise, bundle exclusion risk |

---

## 8. Documentation debt

| Document | Problem |
|---|---|
| `docs/REQUIREMENTS_TRACEABILITY.md` | 86-row snapshot dated 2026-11-06; predates Modules 4–8 and the React app; uses a different status vocabulary |
| `docs/PROJECT_STATUS.md` | accurate in intent but overstates readiness where BUG-001 blocks the workflow |
| No formal 249-requirement NLAMS specification | audit baseline had to be repository-derived (see matrix limitation) |
| `docs/DEMO_*` untracked | demo instructions exist only on this workstation |

---

## 9. Suggested fix order (for a follow-up task, not this audit)

1. **BUG-001** + regression test (P0).
2. **BUG-002/003** so the integration suite is green (P1).
3. **BUG-004** (P1, trivial).
4. **BUG-006** (wire forgot-password), **BUG-007** (project close), **BUG-008** (role admin) — visible completeness gaps.
5. **BUG-013** CI running frontend + backend tests (P1).
6. Security items SEC-1/SEC-2 before any real citizen data.
7. Perf: route-level code splitting to cut the 944 kB entry chunk.
