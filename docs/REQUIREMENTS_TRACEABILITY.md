# LandNexus — Requirements Traceability Audit

**Audit date:** 2026-11-06  
**Audit type:** read-only, static code and repository inspection  
**Repository:** `D:\landnexus-platform`  
**Audited revision:** `e3a62f1` (`Module 3 part 3: secure land documents`) plus the uncommitted working-tree changes listed below  
**Output file:** `docs/REQUIREMENTS_TRACEABILITY.md` (the only file created by this audit)

---

## 1. Baseline, method and limitations

### 1.1 Requirements baseline

The requirements document was supplied in chat as pasted text. **No repository path or file was provided**, and the placeholder `<FULL PATH TO THE USER'S REQUIREMENTS DOCUMENT>` was never filled. The requirement statements in this matrix are the normalized statements used for the audit. IDs (`M1-01`, `M2-01`, `X-01`, …) were assigned by this audit because the pasted text did not carry stable requirement IDs.

**Important:** the list of “30 required frontend pages” referred to in the brief is **not present** in the supplied requirements text and is **not present anywhere in the repository**. The audit therefore records the actual page inventory and raises the missing list as a question (§7, Q2). It does not invent a 30-page list.

### 1.2 What was inspected

- All backend Java sources under `landnexus-backend/src/main/java/com/landnexus`, all 45 test files under `src/test/java`, `pom.xml`, and `application.properties`.
- All Flyway migrations `V1`–`V7` under `src/main/resources/db/migration`.
- Frontend routes, navigation, API clients, feature pages, tests, `package.json`, `README.md`, and the isolated legacy prototype.
- Project documents: `docs/PROJECT_STATUS.md`, `PROJECT_PLAN.md`, `AUDIT_AND_SCOPE.md`, `SECURITY_AND_AUTH.md`, `ADMINISTRATION_MODULE.md`, `PROPOSAL_WORKFLOW.md`.
- The untracked `scripts/full-demo.ps1`, a synthetic end-to-end demo of Modules 1–3. It was **not executed**; it is noted as supporting evidence that the M1–M3 backend flow was intended to be demonstrated end to end.

### 1.3 What was not done

No application was started. No database was migrated. **No build or test command was executed.** Test counts below are static counts of `@Test` / `it(` declarations, not execution results. See §9.

### 1.4 Status legend (used exactly as required)

| Status | Meaning in this audit |
|---|---|
| `IMPLEMENTED-TESTED` | Code exists and named automated tests exist in the repository. Tests were **not executed** during this audit unless explicitly stated. |
| `IMPLEMENTED-UNTESTED` | Code exists but no meaningful automated test or execution evidence was found. |
| `PARTIAL` | Some required behaviour exists, but named sub-requirements are missing, limited, or not end-to-end. |
| `NOT-IMPLEMENTED` | No implementation found. |
| `BLOCKED-EXTERNAL` | Depends on an external system, credentials, or authority that is not available in the repository. |
| `OUT-OF-SCOPE-BY-RULE` | The requirement is not applicable to that side (for example a server-enforced control has no frontend counterpart), or the audit rules forbid it. |

### 1.5 Module key used by this audit

| Module | Scope |
|---|---|
| M1 | Administration, identity, access control, audit, geographic scope |
| M2 | Consultant proposals and government projects |
| M3 | Land records and supporting documents |
| M4 | Land acquisition |
| M5 | Field surveys |
| M6 | Valuation and compensation |
| M7 | GIS, monitoring and MIS |
| X | Cross-cutting architecture, security, API and delivery rules |

### 1.6 Working-tree state at audit time

`git status` shows the audit ran against a **dirty working tree**:

- Modified but uncommitted: `LandNexus-frontend/README.md`, `breadcrumbs.ts`, `navigation.ts`, `roadmapModules.ts`, `router.tsx`, `myWork/ScopeMap.tsx`, `docs/PROJECT_STATUS.md`.
- Untracked: `LandNexus-frontend/src/features/gis/`, `LandNexus-frontend/src/features/myWork/mapNames.ts`, `scripts/full-demo.ps1`, and this audit document.
- Branch `main` is ahead of `origin/main` by 6 commits. Nothing is pushed.

`scripts/full-demo.ps1` (last written 2026-11-06 23:35) is a synthetic, DEMO-labelled end-to-end script for Modules 1–3. It is untracked and was not run during this audit. It reinforces that Modules 1–3 are intended to be demonstrable, but it is not test-execution evidence.

This matters: the district GIS work and the current status document are **not in the committed baseline**, so another machine cannot reproduce this audit from `origin/main`.

---

## 2. Summary

### 2.1 Status counts per module and per side

Cell format: `IMPLEMENTED-TESTED / IMPLEMENTED-UNTESTED / PARTIAL / NOT-IMPLEMENTED / BLOCKED-EXTERNAL / OUT-OF-SCOPE-BY-RULE`.

| Module | Rows | Backend counts | Frontend counts |
|---|---:|---|---|
| M1 — Administration, identity, access, audit | 13 | 11 / 1 / 0 / 1 / 0 / 0 | 9 / 1 / 1 / 0 / 0 / 2 |
| M2 — Proposals and projects | 14 | 12 / 0 / 0 / 2 / 0 / 0 | 12 / 0 / 0 / 2 / 0 / 0 |
| M3 — Land records and documents | 11 | 11 / 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 11 / 0 / 0 |
| M4 — Land acquisition | 7 | 0 / 0 / 0 / 7 / 0 / 0 | 0 / 0 / 0 / 7 / 0 / 0 |
| M5 — Field surveys | 6 | 0 / 0 / 0 / 6 / 0 / 0 | 0 / 0 / 0 / 6 / 0 / 0 |
| M6 — Valuation and compensation | 7 | 0 / 0 / 0 / 6 / 1 / 0 | 0 / 0 / 0 / 7 / 0 / 0 |
| M7 — GIS, monitoring and MIS | 9 | 0 / 0 / 2 / 6 / 1 / 0 | 1 / 0 / 1 / 7 / 0 / 0 |
| X — Cross-cutting | 19 | 8 / 3 / 2 / 4 / 0 / 2 | 6 / 2 / 3 / 1 / 0 / 7 |
| **Total** | **86** | **42 / 4 / 4 / 32 / 2 / 2** | **28 / 3 / 5 / 41 / 0 / 9** |

**Grand totals across both sides:** 70 `IMPLEMENTED-TESTED`, 7 `IMPLEMENTED-UNTESTED`, 9 `PARTIAL`, 73 `NOT-IMPLEMENTED`, 2 `BLOCKED-EXTERNAL`, 11 `OUT-OF-SCOPE-BY-RULE` (172 side-requirement cells across 86 rows).

### 2.2 Completeness in plain English

The backend is substantially built for the first three modules. Every one of the 38 rows in Modules 1–3 has a backend implementation, and 34 of those 38 are backed by named tests: administration and master data, the 13-role security model, JWT authentication, append-only audit and login history, geographic scope, the full proposal workflow, projects, notifications, land parcels, landowners, ownership, mutations, 7/12 and 8A records, and secure document versioning all exist as real code. Only password reset, the operational security items and the frontend for land records are missing from that early scope.

The frontend tells a different story. It is a real application — not a prototype — with 18 page components (some are honest placeholders), real API clients, route guards and 20 test files. But it covers only login, My Work, proposals, projects, notifications, administration and a district-level GIS map. **Land records and documents have a complete backend and no frontend at all.** Acquisition, field surveys, valuation/compensation and monitoring/MIS are roadmap placeholders on both sides. Modules 4–6 are effectively greenfield: no acquisition, survey, valuation, compensation, PFMS or DBT package, table, endpoint, or page exists.

Overall, the repository is roughly **half delivered** against the full 86-row requirement set by count of fully implemented backend rows (42/86, 49%), but the more useful view is that the delivered slice is deep and tested while the remaining statutory and financial modules are absent. For Modules 1–3 alone the backend is **34/38 fully implemented-tested (89%)**; the frontend is **21/36 applicable rows (58%)** because Module 3 has no UI. The five biggest gaps are listed in §3.

---

## 3. Traceability matrix

> Evidence abbreviations: `Vn` = Flyway migration `Vn__*.sql`; “IT” below means `IMPLEMENTED-TESTED`; full statuses are written out in the table. Endpoint paths are relative to `/api/v1` unless stated.

| ID | Requirement | Module | Backend status | Backend evidence | Frontend status | Frontend evidence | Notes |
|---|---|---|---|---|---|---|---|
| M1-01 | Maintain the administrative hierarchy: ministry, department, state, division, district, taluka, village, with codes and parent relationships. | M1 | IMPLEMENTED-TESTED | `V2__administration_master_data.sql`; `MinistryController` … `VillageController`; `MinistryService` … `VillageService`; tests `MinistryServiceTest` … `VillageServiceTest`, `MinistryControllerTest` … `VillageControllerTest`. | IMPLEMENTED-TESTED | `src/features/admin/master/MasterDataPage.tsx`, `MasterDataForm.tsx`; `MasterDataPage.test.tsx`; `src/api/administration.ts`. | Hierarchy and parent rules are enforced server-side; district/division same-state rule in `DistrictService`. |
| M1-02 | Paged lists with parent filters (`ministryId`, `stateId`, `districtId`, `talukaId`) and a capped page size. | M1 | IMPLEMENTED-TESTED | `shared/pagination/PageParams.java` (`MAX_SIZE = 100`), `PageResponse.java`; list endpoints in all seven master controllers; `PageParamsTest`, `PageParamsSortTest`. | IMPLEMENTED-TESTED | `MasterDataPage.tsx` paged table and parent filters; `MasterDataPage.test.tsx`. | Page size is clamped, not trusted from the client. |
| M1-03 | No hard delete of master data; activation/deactivation only; status changes audited. | M1 | IMPLEMENTED-TESTED | `POST /administration/{resource}/{id}/activate` and `/deactivate`; no `@DeleteMapping`; `status` constraints in V2; `AuditAndScopeIntegrationTest`. | IMPLEMENTED-TESTED | Activate/deactivate actions in `MasterDataPage.tsx`; no delete action; test covers write permission. | “Delete” is deliberately absent. |
| M1-04 | Provide the 13 required roles, a permission catalogue, and a read-only role/permission matrix. | M1 | IMPLEMENTED-TESTED | `V3__security_users_roles.sql` inserts 13 roles and 4 permissions; `RoleController` (`GET /administration/roles`); `V6`/`V7` add land/document permissions; `SecurityEndpointsTest`. | IMPLEMENTED-TESTED | `src/features/admin/users/RolesPage.tsx`, `RolePicker.tsx`; `RolesPage.test.tsx`. | Permissions are additive per module; the frontend catalogue is read-only by design. |
| M1-05 | User management: create, list, full role replacement, enable/disable, scope editing, password policy, SUPER_ADMIN protections. | M1 | IMPLEMENTED-TESTED | `UserController`, `UserService`, `shared/validation/PasswordPolicy`; `V3`; `UserServiceTest`, `AuthFlowIntegrationTest`. | IMPLEMENTED-TESTED | `UsersPage.tsx`, `UserCreateForm.tsx`, `UserRolesForm.tsx`, `UserScopesDialog.tsx`; `UsersPage.test.tsx`. | Self-disable blocked; only SUPER_ADMIN can change a SUPER_ADMIN. |
| M1-06 | JWT authentication: login, refresh, logout, current user; short access token, rotating refresh token, lockout and reuse detection. | M1 | IMPLEMENTED-TESTED | `AuthController` (`/auth/login`, `/refresh`, `/logout`, `/me`); `AuthService`; `JwtService`; `TokenHasher`; tests `AuthServiceTest`, `JwtServiceTest`, `TokenHasherTest`, `AuthFlowIntegrationTest`. | IMPLEMENTED-TESTED | `src/api/auth.ts`, `client.ts`, `features/auth/LoginPage.tsx`, `useAuth.ts`; `LoginPage.test.tsx`, `useAuth.test.tsx`, `authSlice.test.ts`. | HS256, BCrypt cost 12, 5-failure/15-minute lockout documented in `SECURITY_AND_AUTH.md`. |
| M1-07 | Self-service password reset or authenticated change-password flow. | M1 | NOT-IMPLEMENTED | `AuthController` exposes only login/refresh/logout/me; no reset token table, mail dependency or reset endpoint in `pom.xml` or V1–V7. | PARTIAL | `features/auth/ForgotPasswordPage.tsx` exists but explicitly says “Password reset is not available yet”; route `/forgot-password`. | Honest placeholder, not implementation. Admin must reset out-of-band today. |
| M1-08 | Append-only audit trail with actor, action, entity, details, filters and `AUDIT_READ`. | M1 | IMPLEMENTED-TESTED | `V4__audit_login_history_scopes.sql` (`audit_events`, `trg_audit_events_append_only`, `forbid_change_of_history()`); `AuditController` (`GET /administration/audit-events`); `AuditService`; `AuditServiceTest`, `AuditQueryServiceTest`, `AuditAndScopeIntegrationTest`. | IMPLEMENTED-TESTED | `features/admin/users/AuditTrailPage.tsx`; `AuditTrailPage.test.tsx`; `src/api/admin.ts`. | Database refuses UPDATE/DELETE; a superuser could still drop the trigger (documented limit). |
| M1-09 | Login history: one row per attempt with success/failure, reason, IP and user agent; append-only; `AUDIT_READ`. | M1 | IMPLEMENTED-TESTED | `V4` (`login_history`, append-only trigger); `AuditController` (`GET /administration/login-history`); `AuditQueryService`; `AuthFlowIntegrationTest`. | IMPLEMENTED-TESTED | `features/admin/users/LoginHistoryPage.tsx`; `LoginHistoryPage.test.tsx`. | Failure reason is stored but never returned to the unauthenticated caller. |
| M1-10 | Geographic scope: assign any number of state/division/district scopes; deny by default; `my-districts`; scope replacement. | M1 | IMPLEMENTED-TESTED | `V4` (`user_geographic_scopes`); `GeoScopeController` (`GET /administration/my-districts`, `GET/PUT /administration/users/{id}/scopes`); `GeoScopeService`; `GeoScopeServiceTest`, `AuditAndScopeIntegrationTest`. | IMPLEMENTED-TESTED | `UserScopesDialog.tsx`; `useScopeDistricts`; GIS page consumes `/administration/my-districts`; `UsersPage.test.tsx`. | Nationwide roles need no assignment; other roles with no assignment see nothing. |
| M1-11 | Geographic scope must be enforced on every district-bound record, not only on dropdown data. | M1 | IMPLEMENTED-TESTED | `ProposalService` line ~314 calls `geoScope.requireDistrictAccess`; `ProposalAccess`; `LandAccess`; `ParcelService`; `LandownerService`; `DocumentService.requireWriteScope`; integration tests cover scope. | OUT-OF-SCOPE-BY-RULE | Server-authoritative control; the UI cannot enforce it. Frontend uses scoped APIs and `my-districts` for selectors. | This contradicts the stale claim in `PROJECT_STATUS.md` that scope is enforced only on `my-districts`. |
| M1-12 | Automatically stamp `created_by` / `updated_by` on writes. | M1 | IMPLEMENTED-TESTED | `shared/config/JpaAuditingConfig.java`, `SecurityAuditorAware.java`; `created_by`/`updated_by` columns in V2–V7; `AuditAndScopeIntegrationTest` checks stamped rows. | OUT-OF-SCOPE-BY-RULE | Server-side concern. | Historical rows created before slice 2b keep empty values (documented). |
| M1-13 | Secrets only from environment; explicit CORS allowlist; no committed credentials. | M1 | IMPLEMENTED-UNTESTED | `application.properties` uses `${DB_PASSWORD}`, `${JWT_SECRET}`, `${LANDNEXUS_ADMIN_*}`; `SecurityConfig` CORS from `CORS_ALLOWED_ORIGINS`; no keys/PEMs found; `.env.example` contains only public `VITE_*`. | IMPLEMENTED-UNTESTED | `LandNexus-frontend/.env.example` only `VITE_API_BASE_URL`, `VITE_APP_NAME`; `.env` is git-ignored per README. | No config-specific test. `show-sql=true` is a separate risk. |
| M2-01 | Proposal draft with title, 12 project types, district/taluka/department, length rules, hectares, affected villages, description and dates. | M2 | IMPLEMENTED-TESTED | `V5__proposals_projects_notifications.sql`; `ProposalController` (`POST/GET/PUT /projects/proposals`); `ProposalRequest`; `ProposalService`; `ProposalServiceTest`. | IMPLEMENTED-TESTED | `features/proposals/ProposalFormPage.tsx`, `VillagePicker.tsx`; `ProposalFormPage.test.tsx`. | Attachments and map alignment are explicitly deferred. |
| M2-02 | Enforce the proposal state machine; reject invalid transitions with 409; `availableActions` drives the UI. | M2 | IMPLEMENTED-TESTED | `ProposalWorkflow`, `ProposalStatus`, `Transition`; `ProposalService.apply`; `ProposalWorkflowTest`, `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `features/proposals/ActionBar.tsx`, `StatusTimeline.tsx`; `ActionBar.test.tsx`. | UI never rebuilds workflow rules; it renders backend `availableActions`. |
| M2-03 | Role permissions and separation of duties: owner submits, another officer scrutinises, recommender cannot decide, no self-review. | M2 | IMPLEMENTED-TESTED | `ProposalService`; `ProposalController` `@PreAuthorize` for `PROPOSAL_CREATE/SCRUTINIZE/DECIDE`; `ProposalAccess`; `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `RequirePermission`, `ProtectedRoute`, `ActionBar`; `guards.test.tsx`, `ActionBar.test.tsx`. | Backend is the authority; UI only hides actions. |
| M2-04 | Visibility by owner and geographic scope; unauthorised record reads return 404, not 403. | M2 | IMPLEMENTED-TESTED | `ProposalAccess`, `ProposalService.loadVisible`; `ResourceNotFoundException`; `ProposalAccessTest`, `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `src/api/proposals.ts`; list/detail pages rely on server results; error handling in `src/api/errors.ts`. | 404 avoids confirming existence of out-of-scope records. |
| M2-05 | Generate `PRP-YYYY-NNNNNN` and `PRJ-YYYY-NNNNNN` from database sequences; no duplicates. | M2 | IMPLEMENTED-TESTED | `V5` sequences `proposal_number_seq` / project numbering; `ProposalService`; `ProposalServiceTest`, `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `ProposalDetailsPage.tsx`, `ProjectListPage.tsx`, `ProjectDetailsPage.tsx` display server codes. | Rolled-back transactions can leave gaps (documented and expected). |
| M2-06 | Freeze a version snapshot on every submit/resubmit; versions append-only. | M2 | IMPLEMENTED-TESTED | `V5` `proposal_versions` + `trg_proposal_versions_append_only`; `ProposalVersionRepository`; `ProposalService`; `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `features/proposals/VersionViewer.tsx`; `ProposalDetailsPage.tsx`; version diff. | Snapshots are immutable at database level. |
| M2-07 | Append-only status history/timeline with actor, time, action and reason. | M2 | IMPLEMENTED-TESTED | `V5` `proposal_status_history` + trigger; `ProposalStatusHistoryRepository`; `ProposalService`; `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `StatusTimeline.tsx`; `ProposalDetailsPage.tsx`. | Also mirrored into `audit_events`. |
| M2-08 | Require a reason for clarification and rejection; reject blank reasons. | M2 | IMPLEMENTED-TESTED | `TransitionRequest`, `InvalidTransitionException`, `ProposalService`; `ProposalServiceTest`, `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `ActionBar.tsx` reason dialog; `ActionBar.test.tsx`. | Validation is server-side; UI also prompts. |
| M2-09 | Optimistic concurrency: concurrent changes produce 409 and force reload. | M2 | IMPLEMENTED-TESTED | `row_version` in V5 proposals; `ObjectOptimisticLockingFailureException` handler; `ApiExceptionHandler`; `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `ProposalDetailsPage.tsx` reloads on 409; `ProposalFormPage` handles conflict. | No silent last-write-wins. |
| M2-10 | In-app notifications on workflow events: own-only, unread count, mark-as-read, header dropdown. | M2 | IMPLEMENTED-TESTED | `V5` `notifications`; `shared/notification/NotificationController`, `NotificationService`; `NotificationServiceTest`. | IMPLEMENTED-TESTED | `NotificationListPage.tsx`, `NotificationsMenu.tsx`; `NotificationListPage.test.tsx`, `NotificationsMenu.test.tsx`. | No e-mail/SMS; in-app only. |
| M2-11 | Read-only government project register; project created only on approval; details show affected villages and originating proposal. | M2 | IMPLEMENTED-TESTED | `ProjectController` (`GET /projects`, `/projects/{id}`); `ProjectService`; `ProjectResponse`; `ProjectServiceTest`, `ProposalWorkflowIntegrationTest`. | IMPLEMENTED-TESTED | `ProjectListPage.tsx`, `ProjectDetailsPage.tsx`, `ProjectStatusBadge.tsx`; tests for both pages. | No create/edit/delete project UI or API. |
| M2-12 | Server-side filters (status/district), pagination and honest error states for proposals/projects. | M2 | IMPLEMENTED-TESTED | `ProposalController` query params `status`, `districtId`, `page`, `size`; `PageParams`; `PageResponse`; controller tests. | IMPLEMENTED-TESTED | `ProposalListPage.tsx`, `ProjectListPage.tsx`, `src/api/pagination.ts`; tests. | Filters are applied by the backend before pagination. |
| M2-13 | Project milestones, physical/financial progress and milestone tracking. | M2 | NOT-IMPLEMENTED | No milestone/progress table or entity in V1–V7; `Project` has no progress or milestone fields; `ProjectController` has only list/get. | NOT-IMPLEMENTED | `ProjectDetailsPage.tsx` shows project attributes only; no milestone section. | Mentioned as “Module 7” in `PROPOSAL_WORKFLOW.md`; absent. |
| M2-14 | SLA timers, escalation, and e-mail/SMS notifications. | M2 | NOT-IMPLEMENTED | No scheduler, SLA field, mail starter or SMS adapter in `pom.xml`; only in-app notifications. | NOT-IMPLEMENTED | No SLA/escalation UI; notification menu is in-app only. | Explicitly deferred in `PROPOSAL_WORKFLOW.md`. |
| M3-01 | Land parcel register: gat/survey/subdivision number, area in hectares, classification, land use, village hierarchy, activation. | M3 | IMPLEMENTED-TESTED | `V6__land_records_core.sql` (`land_parcels`, uniqueness, check constraints); `ParcelController`, `ParcelService`; `ParcelServiceTest`, `LandRecordsIntegrationTest.parcels_followUniquenessAndGeographicScope`. | NOT-IMPLEMENTED | `/roadmap/land-records` placeholder in `navigation.ts`, `roadmapModules.ts`, `RoadmapPage.tsx`; no API client or page. | Backend-only capability; no UI. |
| M3-02 | Landowner master with owner type, name, guardian, address, phone; sensitive data masked in list views; no government ID numbers. | M3 | IMPLEMENTED-TESTED | `V6` `landowners`; `LandownerController`, `LandownerService`; `LandownerSummary` omits address/phone; `LandownerServiceTest`; integration test checks masking. | NOT-IMPLEMENTED | No landowner page or API client; roadmap only. | PII is deliberately limited and masked. |
| M3-03 | Ownership shares with basis, from/to dates, current-owner uniqueness, end-ownership operation. | M3 | IMPLEMENTED-TESTED | `V6` `parcel_ownerships` + partial unique index; `ParcelRecordsController` (`/ownerships`, `/{id}/end`); `OwnershipService`; `OwnershipServiceTest`, integration test. | NOT-IMPLEMENTED | No ownership UI; roadmap only. | Database enforces one current ownership per owner/parcel. |
| M3-04 | Mutation register: number, date, type, description; unique per parcel. | M3 | IMPLEMENTED-TESTED | `V6` `parcel_mutations`; `ParcelRecordsController` (`GET/POST /mutations`); `LandRecordsIntegrationTest.mutationsAndRevenueRecords_followTheirRules`. | NOT-IMPLEMENTED | No mutation UI; roadmap only. | Seven mutation types constrained in SQL. |
| M3-05 | 7/12 and 8A revenue records with khata rule; text entered by an officer, no OCR. | M3 | IMPLEMENTED-TESTED | `V6` `revenue_records` (`SEVEN_TWELVE`/`EIGHT_A`, khata check); `ParcelRecordsController` (`/revenue-records`); `RevenueRecord` comment says manual entry; integration test. | NOT-IMPLEMENTED | No revenue-record UI; roadmap only. | No OCR, AI or document-reading code exists. |
| M3-06 | Supporting document repository per parcel, with categories and metadata. | M3 | IMPLEMENTED-TESTED | `V7__land_documents.sql` (`land_documents`); `DocumentController` (`GET/POST /land-records/parcels/{parcelId}/documents`); `DocumentService`; `DocumentServiceTest`. | NOT-IMPLEMENTED | `/roadmap/documents` placeholder; no document page or API client. | Backend-only. |
| M3-07 | Immutable document versions with SHA-256 digest and append-only history. | M3 | IMPLEMENTED-TESTED | `V7` `land_document_versions` (`sha256`, `version_no`, `stored_key`) + `trg_land_document_versions_append_only`; `DocumentService.addVersion`; `DocumentServiceTest`. | NOT-IMPLEMENTED | No version-history UI; roadmap only. | Digest is stored and shown in audit text. |
| M3-08 | Validate upload type, extension, declared content type, magic bytes, size and filename. | M3 | IMPLEMENTED-TESTED | `landrecords/application/FileValidator.java` (PDF/JPEG/PNG, extension map, head bytes); `FileValidatorTest`; `LocalFileStorageTest`. | NOT-IMPLEMENTED | No upload UI. | No virus scanner (see X-16). |
| M3-09 | Manual second-person verification/rejection; every download audited. | M3 | IMPLEMENTED-TESTED | `DocumentService.verify/reject` rejects the uploader; `download` records `DOWNLOAD` with version and SHA-256; `DocumentServiceTest`; `LandRecordsIntegrationTest.documents_areValidated_versioned_verifiedByAnotherPerson_andDownloadsAreAudited`. | NOT-IMPLEMENTED | No verification UI; roadmap only. | Separation of duties is server-enforced. |
| M3-10 | Landowner personal data must be audited without names, addresses or phones in audit text. | M3 | IMPLEMENTED-TESTED | `LandownerService` records `detail view` / `personal details changed` only; `LandRecordsIntegrationTest.landownerViews_areAudited_withoutPersonalDataInTheAuditText`. | NOT-IMPLEMENTED | No landowner UI. | Strong privacy evidence; tests assert absence of PII. |
| M3-11 | Geographic scope enforced on all land-record and document endpoints. | M3 | IMPLEMENTED-TESTED | `LandAccess` uses `GeoScopeService.canAccessDistrict`; `ParcelService`, `LandownerService`, `DocumentService.requireWriteScope`; `LandRecordsIntegrationTest` covers scope failures. | NOT-IMPLEMENTED | No land-record UI to scope. | Scope is not merely a dropdown filter. |
| M4-01 | Acquisition case register linked to approved projects and affected parcels. | M4 | NOT-IMPLEMENTED | No `acquisition` package; no acquisition tables in V1–V7; no controller/entity/service. | NOT-IMPLEMENTED | `/roadmap/acquisition` placeholder in `navigation.ts` and `roadmapModules.ts`. | Greenfield. |
| M4-02 | Statutory notice generation/serving and acknowledgement (for example section 11 notification). | M4 | NOT-IMPLEMENTED | No notice entity, template, PDF generation or endpoint. | NOT-IMPLEMENTED | Acquisition roadmap only; no notice UI. | Statutory detail is also an open question (§7, Q4). |
| M4-03 | Objections, claims and hearing register with outcomes. | M4 | NOT-IMPLEMENTED | No objection/hearing table, entity or endpoint. | NOT-IMPLEMENTED | Acquisition roadmap only. | Greenfield. |
| M4-04 | Acquisition survey/measurement of affected land and landowner verification. | M4 | NOT-IMPLEMENTED | No acquisition survey code; `FIELD_OFFICER` role exists but no survey tables or APIs. | NOT-IMPLEMENTED | Acquisition roadmap only. | Distinct from Module 5 field-survey work. |
| M4-05 | Draft award preparation, approval and publication. | M4 | NOT-IMPLEMENTED | No award entity/table/endpoint/workflow. | NOT-IMPLEMENTED | Acquisition roadmap only. | Greenfield. |
| M4-06 | Award payment, possession and handover records. | M4 | NOT-IMPLEMENTED | No possession/handover table or endpoint. | NOT-IMPLEMENTED | Acquisition roadmap only. | Depends on M6 compensation. |
| M4-07 | Acquisition case timeline, document checklists and audit trail. | M4 | NOT-IMPLEMENTED | No acquisition timeline or case-scoped audit; generic `AuditService` exists but is not used for acquisition. | NOT-IMPLEMENTED | Acquisition roadmap only. | Generic audit infrastructure is available to reuse. |
| M5-01 | Survey assignments by district/officer with workload visibility. | M5 | NOT-IMPLEMENTED | No field-survey package, assignment table or endpoint. | NOT-IMPLEMENTED | `/roadmap/field-surveys` placeholder. | `FIELD_OFFICER` role exists only as a security label. |
| M5-02 | Measurement capture (dimensions/area) and verification workflow. | M5 | NOT-IMPLEMENTED | No measurement entity or service; parcel area is a single entered value only. | NOT-IMPLEMENTED | Field-surveys roadmap only. | Greenfield. |
| M5-03 | GPS/coordinate capture and map linkage for surveyed features. | M5 | NOT-IMPLEMENTED | V1 enables PostGIS, but V2–V7 define no `geometry`/`geography` columns; no coordinate fields in survey code. | NOT-IMPLEMENTED | Map is district-level only; no field capture UI. | No fake coordinates were found. |
| M5-04 | Field workflow: assigned → in progress → submitted → verified/returned. | M5 | NOT-IMPLEMENTED | No survey status enum, workflow table or transition endpoint. | NOT-IMPLEMENTED | Field-surveys roadmap only. | Greenfield. |
| M5-05 | Attach survey evidence/photos/documents to a survey. | M5 | NOT-IMPLEMENTED | Document repository is parcel-scoped (`land_documents.parcel_id`); no survey foreign key. | NOT-IMPLEMENTED | No survey UI. | Reusable file storage exists but is not wired to surveys. |
| M5-06 | Mobile/offline field data capture or synchronisation. | M5 | NOT-IMPLEMENTED | No mobile client, sync API, queue or conflict protocol. | NOT-IMPLEMENTED | Frontend is a desktop-responsive web app; no offline field mode. | Greenfield. |
| M6-01 | Valuation per parcel with market value/unit rates and supporting basis. | M6 | NOT-IMPLEMENTED | No valuation package, table, entity or endpoint. | NOT-IMPLEMENTED | `/roadmap/valuation-compensation` placeholder. | Greenfield. |
| M6-02 | Compensation calculation: solatium, interest, rounding and statutory percentages. | M6 | NOT-IMPLEMENTED | No calculation service, rate table or rules. | NOT-IMPLEMENTED | Valuation roadmap only. | Rules are an open question (§7, Q5). |
| M6-03 | Compensation award per landowner/ownership share. | M6 | NOT-IMPLEMENTED | No compensation award table linked to `parcel_ownerships`. | NOT-IMPLEMENTED | Valuation roadmap only. | Ownership data exists to build on. |
| M6-04 | Payment tracking, instalments and receipts. | M6 | NOT-IMPLEMENTED | No payment/instalment/receipt tables or endpoints. | NOT-IMPLEMENTED | Valuation roadmap only. | Greenfield. |
| M6-05 | PFMS/DBT integration, at minimum a mock or pending queue. | M6 | BLOCKED-EXTERNAL | No PFMS/DBT adapter, mock, queue or configuration found; external system and credentials are unavailable. | NOT-IMPLEMENTED | No PFMS/DBT UI. | Even the mock/pending path required by the brief is absent. |
| M6-06 | Finance-officer approval and separation of duties for compensation. | M6 | NOT-IMPLEMENTED | `FINANCE_OFFICER` role exists in V3, but no finance permission, approval endpoint or rule. | NOT-IMPLEMENTED | No finance UI. | Role name exists without capability. |
| M6-07 | Compensation MIS, reconciliation and export. | M6 | NOT-IMPLEMENTED | No aggregate query, report or export endpoint. | NOT-IMPLEMENTED | No MIS page. | Depends on M6-01..06. |
| M7-01 | Permission- and scope-aware district-level project coverage map using real backend data. | M7 | PARTIAL | Backend supplies `GET /projects` and `GET /administration/my-districts`; no dedicated GIS/feature endpoint. | IMPLEMENTED-TESTED | `src/features/gis/GisMapPage.tsx`, `ScopeMap.tsx`; `GisMapPage.test.tsx`; bundled `vardhan-maps`; real project data only. | Only district coverage; no parcel/alignment layers. |
| M7-02 | Store parcel boundary geometry in PostGIS and expose a scoped feature API. | M7 | NOT-IMPLEMENTED | V1 enables PostGIS only; no geometry columns in V2–V7; no feature/bbox endpoint. | NOT-IMPLEMENTED | No parcel geometry or layer UI; explicitly deferred in `PROJECT_PLAN.md` §8.14. | No invented geometry. |
| M7-03 | Store and render project alignment/corridor geometry. | M7 | NOT-IMPLEMENTED | Proposal has text `alignmentDescription` only; no geometry column or alignment API. | NOT-IMPLEMENTED | No alignment drawing/rendering. | Deferred. |
| M7-04 | Bhuvan/ISRO map and satellite-layer integration. | M7 | BLOCKED-EXTERNAL | No Bhuvan adapter, tile source, credential or configuration found. | NOT-IMPLEMENTED | Map uses bundled boundaries, not Bhuvan. | External access required. |
| M7-05 | 3D terrain/parcel visualisation. | M7 | NOT-IMPLEMENTED | No 3D library, tile pipeline, camera/terrain model or API. | NOT-IMPLEMENTED | `package.json` has no 3D/map engine beyond `vardhan-maps`; no 3D page. | Greenfield. |
| M7-06 | Spatial intersection/bounding-box query restricted to the caller’s scope and audited. | M7 | NOT-IMPLEMENTED | No `ST_Intersects`, bbox query, spatial index or scoped feature endpoint. | NOT-IMPLEMENTED | No spatial query UI. | Must reuse `GeoScopeService` when built. |
| M7-07 | Role/scope-aware dashboards and project summaries. | M7 | PARTIAL | List endpoints can be filtered by district/status, but no aggregate/summary endpoint exists. | PARTIAL | `MyWorkPage.tsx` derives counts from paged APIs (`useDistrictCount`, `readAllPages`); no server aggregate. | Client-side counting is not a dashboard API. |
| M7-08 | MIS reports and exports (CSV/PDF) for projects, acquisition and compensation. | M7 | NOT-IMPLEMENTED | No report/export controller, query, template or file generation. | NOT-IMPLEMENTED | No MIS page; `recharts` is installed but unused for reports. | Roadmap `/roadmap/monitoring-mis`. |
| M7-09 | SLA monitoring, escalation alerts and ageing reports. | M7 | NOT-IMPLEMENTED | No SLA fields, scheduler, escalation service or ageing query. | NOT-IMPLEMENTED | No SLA UI. | Same gap as M2-14. |
| X-01 | Modular monolith organised into seven business modules with four layers (`api`, `application`, `domain`, `infrastructure`). | X | PARTIAL | Four top-level packages only: `administration`, `landrecords`, `projects`, `shared`; the three feature packages do use the four layers. Modules 4–7 have no package. | PARTIAL | Feature-sliced frontend (`features/admin`, `auth`, `proposals`, `projects`, `landrecords` absent, etc.); no acquisition/survey/valuation/MIS features. | The physical structure does not match “seven modules”; only three business domains exist. |
| X-02 | Thin controllers; request/response DTOs; never return JPA entities. | X | IMPLEMENTED-TESTED | Controllers delegate to services; `api/dto` records such as `ParcelResponse`, `ProjectResponse`, `ProposalResponse`; `spring.jpa.open-in-view=false`; controller tests assert JSON shapes. | OUT-OF-SCOPE-BY-RULE | Server concern. Frontend consumes typed DTOs in `src/api/types.ts`. | No entity serialization found. |
| X-03 | Flyway-only schema management; never edit an applied migration; `ddl-auto=validate`. | X | IMPLEMENTED-UNTESTED | Sequential `V1`–`V7`; `spring.flyway.enabled=true`; `spring.jpa.hibernate.ddl-auto=validate`; no `schema.sql`/`data.sql`. | OUT-OF-SCOPE-BY-RULE | Server concern. | No Flyway checksum or “no edited migration” test. V7 is newly added, not an edit. |
| X-04 | Permissions enforced on the backend, never only in the UI. | X | IMPLEMENTED-TESTED | `@PreAuthorize` on every controller method; `SecurityConfig`; `SecurityEndpointsTest`, `AuthFlowIntegrationTest`, `ProposalWorkflowIntegrationTest`, `LandRecordsIntegrationTest`. | IMPLEMENTED-TESTED | `ProtectedRoute.tsx`, `RequirePermission.tsx`, `utils/permissions.ts`; `guards.test.tsx`. | UI guards are convenience only; backend is authoritative. |
| X-05 | Deny by default and hide out-of-scope records (404 rather than 403 for reads). | X | IMPLEMENTED-TESTED | `GeoScopeService` deny-by-default; `ProposalService.loadVisible` returns 404; `LandAccess`; `GeoScopeServiceTest`, `ProposalAccessTest`. | OUT-OF-SCOPE-BY-RULE | Frontend shows server errors honestly; cannot decide visibility. | `PROJECT_STATUS.md` claim that scope applies only to `my-districts` is false. |
| X-06 | Append-only audit/history and no secrets or PII in audit text. | X | IMPLEMENTED-TESTED | V4 `forbid_change_of_history()` + triggers on `audit_events`, `login_history`; V5 triggers on proposal history/versions; V7 trigger on document versions; `AuditServiceTest`, `LandRecordsIntegrationTest.landownerViews...`. | OUT-OF-SCOPE-BY-RULE | Server concern; audit page is read-only. | Strongest implemented non-functional control. |
| X-07 | Secrets only in environment variables; no committed keys or credentials. | X | IMPLEMENTED-UNTESTED | `application.properties` placeholders only; `.gitignore`; no `.env`, PEM, key or password literal found. | IMPLEMENTED-UNTESTED | `.env.example` has only public `VITE_*`; README forbids secrets. | Frontend refresh token is in `sessionStorage` (risk, not a secret leak). |
| X-08 | No AI/ML/OCR; land data is entered and verified by people. | X | IMPLEMENTED-TESTED | No AI/ML/OCR dependency in `pom.xml` or `package.json`; `RevenueRecord` and `LandDtos` comments confirm manual entry; no model, inference or OCR code. | IMPLEMENTED-TESTED | No AI/OCR UI or client. | Negative requirement satisfied. |
| X-09 | External integrations must be real or explicitly mocked/pending, never faked. | X | PARTIAL | No PFMS, DBT, Bhuvan, e-sign or SMS adapter and no mock/pending queue; in-app notifications are real. | PARTIAL | No integration UI or fake integration data. | Real calls are `BLOCKED-EXTERNAL`; the “mock now” obligation is also unmet. |
| X-10 | Server pagination with capped size and stable sort. | X | IMPLEMENTED-TESTED | `PageParams` (`MAX_SIZE=100`, negative page clamped, sort) and `PageResponse`; used by master data, proposals, projects, notifications, land records; `PageParamsTest`, `PageParamsSortTest`. | IMPLEMENTED-TESTED | `src/api/pagination.ts`, `readAllPages`; paged tables in list pages; tests. | Stable JSON shape; Spring `Page` is not serialized directly. |
| X-11 | Centralised exception handling with a consistent error shape for 400/401/403/404/405/409/500. | X | IMPLEMENTED-TESTED | `shared/exception/ApiExceptionHandler.java`, `ApiError.java`; handlers for validation, auth, access denied, not found, conflict, malformed body, type mismatch, optimistic lock, data integrity, unexpected. | IMPLEMENTED-TESTED | `src/api/errors.ts`, `src/api/client.ts`; friendly error states in pages; `errors.test.ts`, `client.test.ts`. | 405 is handled by Spring’s error path and mapped to a safe status. |
| X-12 | Consistent success response shapes (page envelope, DTOs) across modules. | X | IMPLEMENTED-TESTED | All lists return `PageResponse`; all detail/write responses are records; no raw maps or entities. | IMPLEMENTED-TESTED | `src/api/types.ts`, `pagination.ts`; typed clients. | Consistency is good in the implemented slice. |
| X-13 | OpenAPI/Swagger documentation for the API. | X | NOT-IMPLEMENTED | No `springdoc`/Swagger dependency, annotation, config or generated spec in `pom.xml` or source. | OUT-OF-SCOPE-BY-RULE | No API docs UI. | Pure backend gap. |
| X-14 | Docker/containerisation and a repeatable compose stack. | X | NOT-IMPLEMENTED | No `Dockerfile`, `.dockerignore`, `docker-compose.yml` or deployment manifest found. | NOT-IMPLEMENTED | No container build for the frontend. | Documented as “later”. |
| X-15 | Rate limiting / abuse protection beyond per-account lockout. | X | NOT-IMPLEMENTED | No filter, bucket, gateway config or rate-limit dependency; only `AuthService` account lockout. | OUT-OF-SCOPE-BY-RULE | Server concern. | Per-IP protection absent. |
| X-16 | Virus/malware scanning of uploaded documents. | X | NOT-IMPLEMENTED | `FileValidator` comment explicitly says “No virus scanner in this prototype”; no ClamAV/Tika/scanner dependency. | OUT-OF-SCOPE-BY-RULE | Server concern. | File type/size validation exists, but not malware scanning. |
| X-17 | Deliver the 30 required frontend pages. | X | OUT-OF-SCOPE-BY-RULE | Backend not applicable. | PARTIAL | 18 page components/routes exist (login, forgot-password, My Work, proposals list/form/details, projects list/details, GIS, notifications, master data, users, roles, audit, login history, roadmap, 403, 404); 6 roadmap placeholders. The 30-page list is absent. | Cannot verify exact coverage without the list (§7, Q2). |
| X-18 | Automated backend and frontend tests. | X | IMPLEMENTED-UNTESTED | 324 `@Test` declarations across 45 files; named unit/controller/integration tests; no execution during audit. | IMPLEMENTED-UNTESTED | 84 `it(`/`test(` declarations across 20 files (Vitest + RTL + MSW); no execution during audit. | Static count only. See §9. |
| X-19 | No demo/prototype data in the production UI. | X | OUT-OF-SCOPE-BY-RULE | Backend has no demo seeding in migrations. | IMPLEMENTED-TESTED | `src/legacy-prototype/` is excluded from TypeScript compilation and not imported; production pages call `src/api/*`; tests use MSW. | The prototype is preserved only as reference. |

---

## 4. Gaps

### 4.1 High

1. **Modules 4, 5 and 6 are entirely absent.** There is no acquisition, field-survey, valuation or compensation package, table, endpoint or page. The statutory acquisition chain (notice → objection/hearing → survey → draft award → award → possession) and the financial chain (valuation → solatium/interest → compensation → payment/receipt) do not exist. This is the largest delivery gap and the main blocker to calling the platform functionally complete.
2. **Module 3 has no frontend.** Parcels, landowners, ownership, mutations, 7/12, 8A and documents are fully implemented and tested on the backend, but the frontend only shows `/roadmap/land-records` and `/roadmap/documents`. A complete backend capability is unusable to end users.
3. **GIS is district-coverage-only.** There are no PostGIS geometry columns, parcel boundaries, project alignments, spatial intersection/bbox API, Bhuvan integration or 3D view. The current map is honest and scope-aware, but it is not the parcel-level GIS described in `PROJECT_PLAN.md` §8.14.
4. **Monitoring, MIS, dashboards, reports/exports and SLA are absent.** There is no aggregate endpoint, report generator, CSV/PDF export, SLA field, scheduler or escalation service. `MyWorkPage` counts records client-side from paged APIs.
5. **Operational security and delivery hardening is incomplete.** Password reset/change-password, per-IP rate limiting, virus scanning, OpenAPI and Docker are all missing. These are exactly the items the brief asked to verify.
6. **The status document is materially stale.** `docs/PROJECT_STATUS.md` still says Modules 3–7 are pending and tells the reader not to start land records, while Module 3 is committed at `e3a62f1`. It also understates geo-scope enforcement and test counts. See §6.

### 4.2 Medium

- Project milestones/progress (M2-13) and SLA/e-mail/SMS (M2-14) are missing.
- PFMS/DBT/Bhuvan/e-sign/SMS have no real adapter **and no mock or pending queue**, so even the “mock until external access” requirement is unmet.
- The “30 required frontend pages” list is missing, so exact frontend scope compliance cannot be proved.
- The backend is a modular monolith in practice, but only three business packages exist; the “seven modules” structure is not physically represented.
- No repository-level tests against real PostgreSQL/Testcontainers were found; integration tests exist but their execution environment is unclear.
- No Flyway checksum/edit guard test; migration discipline is a convention, not an automated check.
- `spring.jpa.show-sql=true` and formatted SQL are enabled in `application.properties`, which can leak query values into logs.

### 4.3 Low

- Documentation drift: test counts in `PROJECT_STATUS.md` (181/64/78) do not match the static counts (324/84); “Last updated” predates the Module 3 commits.
- Frontend refresh token is stored in `sessionStorage`, which is readable by any XSS; the access token is correctly in memory.
- The legacy prototype is still present (isolated) and could confuse future contributors; it is not imported.
- Role names `FIELD_OFFICER` and `FINANCE_OFFICER` imply capabilities that do not exist yet.
- No explicit data-retention policy for landowner PII or login IP addresses.
- API documentation is absent, slowing frontend/backend contract work.

---

## 5. Risks and inconsistencies

| # | Risk / inconsistency | Evidence | Impact |
|---|---|---|---|
| R1 | `PROJECT_STATUS.md` says “Modules 3-7 … pending” and “Do not start … land records, documents … before confirmation.” | `docs/PROJECT_STATUS.md` lines 84–101; HEAD `e3a62f1` is “Module 3 part 3: secure land documents”. | A new contributor would duplicate or ignore completed work. |
| R2 | `PROJECT_STATUS.md` says geographic scope is “enforced only on my-districts so far”. | Line 92; `ProposalService`, `LandAccess`, `ParcelService`, `LandownerService`, `DocumentService` all call `GeoScopeService`. | Understates a working security control and misdirects review effort. |
| R3 | `PROJECT_STATUS.md` reports 181 backend / 64 / 78 frontend tests. | Lines 18, 31, 53; static counts are 324 backend and 84 frontend. | Status reporting is unreliable; no execution evidence is recorded. |
| R4 | `PROJECT_STATUS.md` “Last updated: 2026-11-05” predates the 2026-11-06 Module 3 commit. | Line 3; HEAD commit date 2026-11-06 23:27 +0530. | The document cannot be the source of truth. |
| R5 | The brief/repo refer to 30 required frontend pages, but no list exists. | No such list in `docs/` or the supplied text; 18 page components found. | Frontend completeness is unverifiable; risk of building the wrong pages. |
| R6 | Working tree is dirty and 6 commits are unpushed. | `git status`: modified README/navigation/router/ScopeMap/PROJECT_STATUS and untracked `features/gis/`, `mapNames.ts`; branch ahead of `origin/main` by 6. | The audited behaviour (GIS, V7) is not reproducible from `origin/main`. |
| R7 | Modules 4–6 are absent while their roles exist. | V3 defines `FIELD_OFFICER`, `FINANCE_OFFICER`, `COMPETENT_AUTHORITY`; no acquisition/valuation permissions or tables. | Demo users can be assigned roles that grant no module capability; expectations mismatch. |
| R8 | `show-sql=true` in the default profile. | `application.properties` lines 11–12. | Query values, including possibly PII, may appear in logs. |
| R9 | Refresh token in `sessionStorage`. | `src/api/client.ts` lines 37–48; README documents it. | XSS could exfiltrate a 7-day refresh token; access token is safer in memory. |
| R10 | No rate limiting beyond account lockout. | `SECURITY_AND_AUTH.md` line 26; no rate-limit code/dependency. | Credential stuffing and API abuse are only partially mitigated. |
| R11 | No virus scanning. | `FileValidator` comment; no scanner dependency. | Malicious files can be stored and later downloaded by another officer. |
| R12 | No OpenAPI contract. | `pom.xml` has no springdoc/Swagger. | Frontend/backend integration relies on hand-maintained TypeScript types. |
| R13 | No Docker/compose. | No Dockerfile/compose anywhere. | Environment setup is manual and demo reproducibility is weak. |
| R14 | Audit is tamper-resistant, not tamper-proof. | `AUDIT_AND_SCOPE.md` line 9: a superuser can drop the trigger. | A privileged insider could alter history; hash chaining/external shipping is not implemented. |
| R15 | PII retention is undefined. | `AUDIT_AND_SCOPE.md` line 16; landowner phone/address in V6. | Compliance risk once real data is loaded. |
| R16 | The frontend map relies on bundled boundary names and falls back on unmatched names. | `ScopeMap.tsx`, `mapNames.ts`; README F5 notes a visible fallback. | Some districts may not colour correctly without a data-quality check. |
| R17 | Module 2 `Project` has no progress/milestone model. | `Project.java`; `ProjectController` list/get only. | “Project management” is currently a register, not lifecycle management. |
| R18 | No test execution evidence in this audit. | All counts are static; §9. | Passing tests are assumed, not proven, for this revision. |

---

## 6. Comparison with `docs/PROJECT_STATUS.md`

The current file (modified but uncommitted) is **stale and partly wrong**. Statements that no longer match the repository:

| Statement in `PROJECT_STATUS.md` | Reality | Verdict |
|---|---|---|
| “Pending: … Modules 3-7” (line 88) | Module 3 backend is implemented in V6/V7 and committed at `e3a62f1`. | **Wrong/outdated** |
| “Next exact task: … Do not start parcel-level GIS, land records, documents, field surveys, valuation or Docker work …” (lines 99–102) | Land records and documents are already started and substantially delivered on the backend. | **Wrong/outdated** |
| “Geographic scope is enforced only on my-districts so far; proposals/parcels must call GeoScopeService” (line 92) | Proposals, parcels, landowners and documents already call `GeoScopeService`; tests cover it. | **Wrong** |
| “181 tests” backend (line 18) | 324 `@Test` declarations across 45 files (static). | **Outdated** |
| “14 files, 64 tests” (line 31), “19 files, 78 tests” (line 53) | 20 files, 84 tests (static); F5 is present. | **Outdated** |
| “Last updated: 2026-11-05” (line 3) | Module 3 commit is 2026-11-06; working tree has further F5/GIS changes. | **Outdated** |
| “weak local DB password: change before any demo” (line 96) | `application.properties` reads `DB_PASSWORD` from the environment; no password literal exists in the repo. | **Unsupported by repository evidence** |
| “Nothing has been pushed to GitHub (local commits only)” (line 97) | Still true: `main` is ahead of `origin/main` by 6 commits, nothing pushed. | **Correct** |
| “F5 complete … district-level coverage map” (lines 56–75) | Matches `GisMapPage.tsx` and its test. | **Correct** |
| “No demo records or invented counts” (lines 32–33, 54–55, 73–75) | Matches: legacy prototype is isolated; pages use real APIs. | **Correct** |

The document should be rewritten from the current revision or replaced by a generated status report. Until then it must not be used as the delivery source of truth.

---

## 7. Questions for the user

1. **Where is the requirements document?** The audit received pasted text, not a file path. Can you provide the exact path (or re-paste it) so the IDs and wording can be re-keyed to the original?
2. **What is the “30 required frontend pages” list?** It is absent from the supplied text and the repository. Please provide the page names and expected routes; the current app has 18 page components and 6 roadmap placeholders.
3. **Which modules are in the current contract?** Are Modules 4–7 (acquisition, field surveys, valuation/compensation, GIS/MIS) expected now, or are they roadmap items for a later phase?
4. **Which statutory acquisition workflow applies?** Please confirm the Act/rules, notice sections, hearing/objection rules, award authority, and possession procedure.
5. **What are the valuation and compensation rules?** Market-value method, solatium percentage, interest rate/period, rounding, and the authoritative rate source.
6. **Which external systems are real vs mock?** PFMS, DBT, Bhuvan/ISRO, e-sign, e-mail/SMS: do sandbox credentials exist, or should adapters be mocked/pending?
7. **Is password reset self-service or admin-only?** If self-service, which mail/SMS provider and token lifetime?
8. **What are the acceptance criteria for rate limiting, virus scanning, OpenAPI and Docker?** For example, per-IP limits, ClamAV, springdoc, and a compose stack with PostGIS.
9. **Is “seven modules / four layers” a physical package requirement?** Today there are three business packages (`administration`, `landrecords`, `projects`) plus `shared`.
10. **Which database/environment should `mvnw clean verify` use?** Is a dedicated test database or Testcontainers expected?
11. **What are the PII retention rules** for landowner names/phones/addresses and login IP addresses?
12. **Should the legacy prototype be deleted** once the real frontend covers its screens, or kept indefinitely as reference?

---

## 8. Recommended next steps (maximum 10)

1. **Freeze the baseline.** Commit or tag the current V7 + GIS + status changes, or move them to a worktree, so the audit and later work start from a reproducible revision. Push to `origin` when approved.
2. **Obtain the missing inputs.** Get the requirements document path and the 30-page frontend list, then re-key this matrix to the official requirement IDs (§7, Q1–Q2).
3. **Fix the status documents.** Rewrite `docs/PROJECT_STATUS.md` and the frontend README so they state Module 3 backend is done, Modules 4–7 are pending, and scope is enforced beyond `my-districts`.
4. **Build the Module 3 frontend.** Add parcels, landowners, ownership, mutations, 7/12, 8A and document pages against the existing APIs, with permission/scope guards and MSW tests. This is the highest-value next increment because the backend is ready.
5. **Execute the verification commands.** On a clean database, run `.\mvnw.cmd clean verify` in `landnexus-backend`, then `npm run build` and `npm run test` in `LandNexus-frontend`; record the actual counts and failures in the status document.
6. **Harden authentication and uploads.** Add self-service or admin password reset, per-IP rate limiting, and malware scanning; document the chosen providers and limits.
7. **Add API and deployment contracts.** Add springdoc/OpenAPI, a `Dockerfile` for each app, and a compose stack with PostgreSQL/PostGIS and the storage volume.
8. **Design Module 4 acquisition.** Model cases, statutory notices, objections/hearings, survey, draft award, award and possession; reuse the existing audit/geo-scope patterns.
9. **Design Module 6 valuation/compensation.** Model rates, solatium/interest, per-owner awards, payments/receipts, and a PFMS/DBT mock adapter with a pending queue.
10. **Plan Module 5 and Module 7.** Field-survey assignment/measurement/evidence, then parcel/alignment geometry, scoped spatial API, MIS reports and SLA monitoring. Do not add invented geometry in the meantime.

---

## 9. Commands run and not run

### 9.1 Commands run (read-only inspection)

| Command | Purpose |
|---|---|
| `git -C D:\landnexus-platform status --short` | Capture modified/untracked files. |
| `git -C D:\landnexus-platform log -1 --format="%h %ad %s" --date=iso` | Identify the audited commit and date. |
| `git -C D:\landnexus-platform status` / `git diff --stat` | Confirm branch position and working-tree scope. |
| `Get-ChildItem` on migrations, Java sources, tests, frontend features, docs | Inventory files. |
| `Select-String` over controllers, services, migrations, tests, `pom.xml`, `package.json`, `application.properties` | Extract endpoints, permissions, tables, tests, dependencies and configuration. |
| `Get-Content` on `PROJECT_STATUS.md`, `PROJECT_PLAN.md`, `AUDIT_AND_SCOPE.md`, `SECURITY_AND_AUTH.md`, `ADMINISTRATION_MODULE.md`, `PROPOSAL_WORKFLOW.md`, frontend README, selected source files | Read evidence. |
| `Select-String ... '@Test\b'` and `^\s*(it|test)\(` | Static test counts: 324 backend, 84 frontend. |

### 9.2 Commands explicitly **not** run

| Command | Reason |
|---|---|
| `.\mvnw.cmd clean verify` | Not explicitly requested in chat; the brief says not to run builds unless requested. |
| `npm run build` | Not explicitly requested; no build execution. |
| `npm run test` | Not explicitly requested; no test execution. |
| `spring-boot:run` / `npm run dev` | The application was not started. |
| `scripts/full-demo.ps1` | Not executed; it requires a running backend and a seeded synthetic dataset. |
| Any Flyway `migrate` / database command | No database was touched. |
| Any `git commit`, `git push`, `git checkout`, `git clean` | The audit is read-only; only this document was added. |

**Consequence:** every `IMPLEMENTED-TESTED` status means “implementation and named tests exist in the repository”, **not** “the tests passed in this audit”. The counts in §2 and §5 are static declaration counts.

---

*End of audit.*
