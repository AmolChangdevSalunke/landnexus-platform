# 2. Module-Wise Audit — LandNexus / NLAMS

**Audit date:** 14 November 2026 · **Type:** read-only inspection + executed tests
**Status vocabulary:** `IMPLEMENTED` · `PARTIAL` · `MISSING` · `MOCK` · `UNVERIFIED`
**Rule applied:** a capability is `IMPLEMENTED` only when frontend surface, backend endpoint, database persistence and an execution path all exist. Evidence from executed tests overrides code reading.

---

## Module summary

| # | Module | Status | Capabilities audited | IMPLEMENTED | PARTIAL | MOCK | MISSING |
|---|---|---|---|---|---|---|---|
| M1 | Administration, identity & access control | IMPLEMENTED | 20 | 16 | 2 | 0 | 2 |
| M2 | Proposals & government projects | PARTIAL | 18 | 10 | 6 | 0 | 2 |
| M3 | Land records & supporting documents | PARTIAL | 16 | 11 | 1 | 0 | 4 |
| M4 | Land acquisition lifecycle | PARTIAL | 18 | 15 | 3 | 0 | 0 |
| M5 | Field surveys | PARTIAL | 10 | 7 | 1 | 0 | 2 |
| M6 | Valuation & compensation | PARTIAL | 18 | 15 | 0 | 1 | 2 |
| M7 | GIS, monitoring & MIS | PARTIAL | 14 | 11 | 2 | 0 | 1 |
| M8 | Integrations & notifications | PARTIAL | 13 | 4 | 4 | 1 | 4 |
| | **Total** | | **127** | **89** | **19** | **2** | **17** |

Percentages are computed in `FINAL_GAP_ANALYSIS.md` from the 127-row matrix in `REQUIREMENT_TRACEABILITY_MATRIX.md`.

---

## M1 — Administration, identity & access control — `IMPLEMENTED`

**Backend:** `administration/api/*`, `administration/application/*`, `shared/security/*`, `shared/audit/*`
**Frontend:** `features/admin/users/*`, `features/admin/master/MasterDataPage.tsx`, `features/auth/*`
**Database:** `ministries`, `departments`, `states`, `divisions`, `districts`, `talukas`, `villages`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `refresh_tokens`, `password_reset_tokens`, `user_geographic_scopes`, `audit_events`, `login_history`

| Capability | Status | Evidence |
|---|---|---|
| Ministry/department master data CRUD | IMPLEMENTED | `AdministrationController` (`MASTER_DATA_READ/WRITE`), `V2` seeds, `MasterDataPage` |
| Administrative geography (state→village) | IMPLEMENTED | 6 tables + FK chain in `V2`, endpoints under `/api/v1/administration`, cascading selects in `MasterDataPage` |
| 13 roles seeded | IMPLEMENTED | `V3__security_users_roles.sql` inserts 13 roles; verified 13 rows on disposable DB |
| Permission catalogue (~60 codes) | IMPLEMENTED | permission `INSERT`s across 13 migrations; verified distinct codes in DB |
| Backend authorisation on every endpoint | IMPLEMENTED | `@PreAuthorize` in 35 files; only `AuthController` unguarded (by design) |
| Frontend permission gating | IMPLEMENTED | 85 `RequirePermission` usages in `router.tsx` |
| User create / assign roles / enable / disable | IMPLEMENTED | `UserController` POST, PUT `/{id}/roles`, POST `/{id}/enable|disable`; `UsersPage` |
| Role definition editing (permissions per role) | PARTIAL | only `GET /api/v1/administration/roles`; `RolesPage.tsx` is read-only; no write API |
| Login / refresh / logout / me | IMPLEMENTED | `AuthController`, `AuthService`; `AuthFlowIntegrationTest` 8/8 pass |
| Refresh-token rotation + reuse detection ends all sessions | IMPLEMENTED | `AuthService` rotation logic; covered by `AuthFlowIntegrationTest` |
| Login lockout (5 attempts / 15 min) | IMPLEMENTED | `AuthService.MAX_FAILED_ATTEMPTS=5`, `LOCK_DURATION=15m`; integration-tested |
| Password policy + change password | IMPLEMENTED | `PasswordPolicy`, `PasswordService.changePassword`; 1 test defect only (see TESTING_REPORT) |
| Admin-issued one-time reset code + reset endpoint | IMPLEMENTED | `POST /api/v1/administration/users/{id}/password-reset`, `POST /api/v1/auth/reset-password`; 192-bit code, SHA-256 hash, 60 min, session termination; `V15` |
| Forgot-password / reset UI | PARTIAL | `ForgotPasswordPage.tsx` still renders “Password reset is not available yet”; backend endpoints exist but are unreachable from UI |
| Audit trail (append-only) + UI | IMPLEMENTED | `audit_events` + `trg_audit_events_append_only`, `AuditService`, `AuditTrailPage` |
| Login history (append-only) + UI | IMPLEMENTED | `login_history` + trigger, `LoginHistoryPage` |
| Geographic scope model + enforcement | IMPLEMENTED | `user_geographic_scopes`, `GeoScopeService`, `AuditAndScopeIntegrationTest` 6/6 pass |
| IP rate limiting | IMPLEMENTED | `shared/security` rate limiter; `RateLimiterTest` present and passing |
| Multi-factor authentication / SSO | MISSING | no TOTP, WebAuthn or OIDC code found |
| Citizen self-registration | MISSING | only admin-created users; no public signup endpoint or page |

---

## M2 — Proposals & government projects — `PARTIAL`

**Backend:** `projects/api/*`, `projects/application/*`, `projects/domain/*`
**Frontend:** `features/proposals/*`, `features/projects/*`, `features/myWork/*`
**Database:** `proposals`, `proposal_villages`, `proposal_versions`, `proposal_status_history`, `proposal_assignments`, `routing_rules`, `projects`, `project_villages`, `notifications`

| Capability | Status | Evidence |
|---|---|---|
| Proposal draft create/edit | IMPLEMENTED | `ProposalController` POST/PUT, `ProposalService.create/update` (`@Transactional`), `ProposalFormPage` |
| Proposal consistency validation | IMPLEMENTED | `ProposalValidationService`, DB CHECKs (`planned_end_date > planned_start_date`, `length_km > 0`, `estimated_land_area_ha > 0`) |
| Submit → proposal number | PARTIAL | sequence `proposal_number_seq` + CHECK `status='DRAFT' OR proposal_number IS NOT NULL` exist, but submit fails at runtime: `cannot execute nextval() in a read-only transaction` (14 occurrences) |
| Scrutiny start, clarification, resubmit | PARTIAL | transitions defined in `ProposalWorkflow`; blocked by the same read-only transaction defect |
| Recommend + separation of duties | PARTIAL | `ProposalWorkflow` + service check; unit-tested (`ProposalServiceTest` 45 tests) but integration execution fails |
| Approve → create project + acquisition case | PARTIAL | `approveWithRecovery`/`approveAttemptInTransaction`/`AcquisitionCaseInitiator` exist; integration proof blocked (fixtures fail first) |
| Reject with mandatory reason + reopen preserving number | PARTIAL | `reject()`/`REOPEN` implemented; runtime blocked by read-only transaction |
| Proposal status history + versions (append-only) | IMPLEMENTED | `proposal_status_history`, `proposal_versions` + V4 append-only function |
| Workflow authority enforcement | IMPLEMENTED | `WorkflowDefinition`/`Transition` enforce allowed action, required authority and reason; unit-tested |
| Routing rules applied on transitions | PARTIAL | `routing_rules` seeded, `ProposalRoutingService` applies them; no admin API/UI despite `ROUTING_RULE_MANAGE` permission |
| Proposal assignments / my tasks | IMPLEMENTED | `proposal_assignments` (V17), `GET /api/v1/projects/proposals/my-tasks`, `MyWorkPage` |
| Project list/detail | IMPLEMENTED | `ProjectController`, `ProjectService.get/list`, `ProjectListPage`, `ProjectDetailsPage` |
| Project edit / close | MISSING | `ProjectService` exposes only `get` and `list`; `projects.status` CHECK allows `CLOSED` but no endpoint sets it |
| Duplicate-safe project/case creation | IMPLEMENTED | `uq_acquisition_cases_project` (V16), `uq_projects` semantics, duplicate-safe code committed in `94875ea` |
| Workflow notifications | IMPLEMENTED | `NotificationService.notify` called from proposal transitions; `notifications` table |
| Consultant sees own / officers scoped | IMPLEMENTED | `ProposalAccess.canView`, `PROPOSAL_READ_OWN`; asserted in `ProposalWorkflowIntegrationTest` (blocked by fixtures) |
| Proposal list filtering/pagination | IMPLEMENTED | `status`, `districtId`, `page`, `size` parameters; `PageResponse` |
| Proposal supporting documents | MISSING | documents are modelled only against parcels (`land_documents.parcel_id`) |

**Critical:** the entire proposal state-change path is non-functional at runtime (P0-1 in `BUGS_AND_TECHNICAL_ISSUES.md`). Static capability is high; executable capability is not.

---

## M3 — Land records & supporting documents — `PARTIAL`

**Backend:** `landrecords/api/*`, `landrecords/application/*`
**Frontend:** `features/landRecords/*`
**Database:** `land_parcels`, `landowners`, `parcel_ownerships`, `parcel_mutations`, `revenue_records`, `land_documents`, `land_document_versions`

| Capability | Status | Evidence |
|---|---|---|
| Parcel CRUD with gat/survey/subdivision uniqueness | IMPLEMENTED | `ParcelService.create/update/setStatus`, `ParcelController`, unique key + `DUPLICATE` message; `ParcelServiceTest` 9/9 pass |
| Classification / land use / parcel status | IMPLEMENTED | `LandTypes` enums, DB CHECKs, `ParcelFormPage` |
| Landowner registry | IMPLEMENTED | `LandownerService`, `LandownerListPage` |
| Ownership records with basis and share | IMPLEMENTED | `parcel_ownerships`, `OwnershipService` (`OwnershipServiceTest` 10/10 pass) |
| Ownership mutation history | IMPLEMENTED | `parcel_mutations` + append-only handling |
| Revenue record 7/12 (manual entry) | IMPLEMENTED | `RevenueRecordType.SEVEN_TWELVE`, `revenue_records`; no external fetch |
| Revenue record 8A (manual, khata required) | IMPLEMENTED | `EIGHT_A` branch requiring khata; DB CHECK |
| Document upload with type/size validation | IMPLEMENTED | `DocumentService.create`, `FileValidator` magic bytes PDF/JPEG/PNG ≤10 MB, `UploadDocumentDialog` |
| Document versioning (append-only) | IMPLEMENTED | `land_document_versions` + V7 version table + append-only trigger |
| Document verify / reject (maker-checker) | IMPLEMENTED | `DocumentService.verify/reject`, `DOCUMENT_VERIFY`, `DocumentDetailsPage` |
| Authorised download | IMPLEMENTED | `DocumentService.download` resolves latest/selected version through `FileStorage`; `LocalFileStorageTest` 5/5 pass |
| Parcel area derived from PostGIS boundary | PARTIAL | `land_parcels.area_ha` is operator-entered; `parcel_boundaries.area_ha` is computed separately and never reconciles automatically |
| Antivirus / malware scanning | MISSING | `FileValidator` comment states “No virus scanner in this prototype” |
| Encryption at rest for stored documents | MISSING | files stored as plain `.bin` on local disk |
| Document retention / legal hold | MISSING | no retention field, job or policy |
| Bulk land-record import | MISSING | no CSV/Excel import endpoint or page |

---

## M4 — Land acquisition lifecycle — `PARTIAL`

**Backend:** `acquisition/api/*`, `acquisition/application/*`
**Frontend:** `features/acquisition/*`
**Database:** `acquisition_cases`, `case_villages`, `case_parcels`, `case_parcel_owners`, `acquisition_case_history`, `legal_notices`, `objections`, `acquisition_awards`, `award_parcels`, `possession_records`, `survey_photos`, `field_surveys`, `asset_records`

| Capability | Status | Evidence |
|---|---|---|
| Case created from approved project | PARTIAL | `CaseLifecycleService.create` + `AcquisitionCaseInitiator`; integration proof blocked by broken test fixtures |
| One case per project | IMPLEMENTED | `uq_acquisition_cases_project` (V16) present on DB |
| Case lifecycle state machine | IMPLEMENTED | `CaseStatus` 9 states, `CaseLifecycleService` transitions, `InvalidTransitionException` |
| Case villages assignment | IMPLEMENTED | `PUT /cases/{id}/villages`, `case_villages` |
| Case parcels add/remove/assign owner | IMPLEMENTED | `POST/DELETE /cases/{id}/parcels`, `POST .../assign`; `case_parcel_owners` |
| Field-officer assignment / my assignments | IMPLEMENTED | `GET /my-assignments`, `MySurveysPage` |
| Survey submit / verify / reject | IMPLEMENTED | `SurveyService`, endpoints under `/surveys`; `SURVEY_PERFORM/VERIFY` |
| Verification report | IMPLEMENTED | `GET /cases/{id}/verification-report` |
| Legal notices issue + register + print | IMPLEMENTED | `legal_notices`, `NoticeRegisterPage`, `NoticePrintPage` |
| Objections file / decide / window close | IMPLEMENTED | `objections`, `objections/{id}/decide`, `close-objection-window` |
| Award declaration + print | IMPLEMENTED | `acquisition_awards`, `award_parcels`, `AwardPrintPage` |
| Possession (physical/deemed) | IMPLEMENTED | `possession_records`, `complete-possession` |
| Case cancellation | IMPLEMENTED | `POST /cases/{id}/cancel` |
| Case status history (append-only) | IMPLEMENTED | `acquisition_case_history` + V4 trigger |
| Framework selection (LARR / NH / Railways / State / Other) | IMPLEMENTED | `AcquisitionFramework` enum persisted on case |
| Statutory framework-specific timelines | PARTIAL | generic SLA rules exist; no per-framework statutory duration model or validation |
| Case closure | IMPLEMENTED | `CLOSED` terminal state via possession completion |
| Notice/objection/award documents generated as files | PARTIAL | print pages render in browser; no server-side PDF generation |

---

## M5 — Field surveys — `PARTIAL`

**Backend:** `acquisition/application/SurveyService`, `SurveyPhotoService`; `gis` validation
**Frontend:** `features/acquisition/SurveyFormPage.tsx`, `MySurveysPage.tsx`
**Database:** `field_surveys`, `survey_photos`

| Capability | Status | Evidence |
|---|---|---|
| Survey record (parcel, date, officer) | IMPLEMENTED | `field_surveys` table + `SurveyService.submit` |
| GPS point capture + validation | IMPLEMENTED | latitude/longitude validated; conflict analysis checks GPS points against boundaries |
| Measurements / area entered | IMPLEMENTED | survey area fields; used by conflict analysis area comparison |
| Survey photo evidence | IMPLEMENTED | `survey_photos` append-only + upload flow |
| Survey verification workflow | IMPLEMENTED | `SUBMITTED/VERIFIED/REJECTED`, verify/reject endpoints |
| Rework loop after rejection | IMPLEMENTED | a new survey can be submitted for the same case parcel; latest status drives UI |
| Survey-to-parcel geometry update | PARTIAL | GIS boundaries are entered separately by officers; no automatic write of survey geometry into `parcel_boundaries` |
| Mobile / offline survey capture | MISSING | responsive web form only; no PWA/offline sync |
| Survey team / equipment / instrument management | MISSING | no tables or endpoints |
| Survey stage SLA / analytics | IMPLEMENTED | `rpt_stage_durations`, `SlaService`, stage-duration report |

---

## M6 — Valuation & compensation — `PARTIAL`

**Backend:** `compensation/api/*`, `compensation/application/*`
**Frontend:** `features/compensation/*`, `features/monitoring/CompensationPage.tsx`
**Database:** `market_value_rates`, `valuation_rule_sets`, `rule_set_components`, `valuations`, `valuation_lines`, `compensation_payments`, `payment_events`, `rr_benefit_types`, `rr_cases`, `rr_entitlements`

| Capability | Status | Evidence |
|---|---|---|
| Market-value rate cards per village/classification | IMPLEMENTED | `RateService`, `market_value_rates`, `RateRulesPage` |
| Rate approval workflow | IMPLEMENTED | `PENDING/APPROVED/REJECTED`, `RATE_APPROVE` |
| Rule sets + ordered components | IMPLEMENTED | `rule_set_components` + append-only trigger; `RuleSetDetailPage` |
| Rule set approve / retire | IMPLEMENTED | `DRAFT/APPROVED/RETIRED`, `RULESET_APPROVE` |
| Valuation computation engine | IMPLEMENTED | `CompensationEngine` (LAND_VALUE, ASSET_VALUE, PERCENT_OF, FIXED_PER_HECTARE), `ValuationService` |
| Valuation submit / approve / reject | IMPLEMENTED | endpoints + `VALUATION_APPROVE`; `CompensationIntegrationTest` 5/5 pass |
| Valuation line breakdown | IMPLEMENTED | `valuation_lines`, `ValuationDetailPage` |
| Payment generation from approved valuation | IMPLEMENTED | `PaymentService.generate`, split across owners (`PaymentSplitter`) |
| Payment release | IMPLEMENTED | `PaymentService.release`, `PAYMENT_RELEASE` |
| Payment event history (append-only) | IMPLEMENTED | `payment_events` + trigger |
| Payment split across multiple owners | IMPLEMENTED | `PaymentSplitter`, owner shares from `case_parcel_owners` |
| PFMS/DBT real disbursement | MOCK | `SimulatedPfmsAdapter` returns `SIM-PFMS-…`; `PaymentModeGuard` refuses non-`SIMULATED` mode |
| Compensation summary / report | IMPLEMENTED | `rpt_compensation`, report catalogue + CSV export |
| R&R benefit catalogue | IMPLEMENTED | `rr_benefit_types`, `BenefitCataloguePage` |
| R&R cases + entitlements | IMPLEMENTED | `rr_cases`, `rr_entitlements`, `RrCaseDetailPage` |
| R&R approve / deliver / complete | IMPLEMENTED | `RrService` transitions, `RR_APPROVE` |
| Beneficiary bank-account validation | MISSING | no bank/IFSC/beneficiary model |
| Settlement / reconciliation feed | MISSING | no reconciliation table, job or endpoint |

---

## M7 — GIS, monitoring & MIS — `PARTIAL`

**Backend:** `gis/api/*`, `gis/application/*`, `reporting/api/*`, `reporting/application/*`
**Frontend:** `features/gis/*`, `features/monitoring/*`, `features/myWork/ScopeMap.tsx`
**Database:** `parcel_boundaries`, `project_alignments`, 6 `rpt_*` views, `sla_rules`, `sla_escalations`

| Capability | Status | Evidence |
|---|---|---|
| Parcel boundary entry (GeoJSON) + PostGIS validation | IMPLEMENTED | `GisService.setParcelBoundary`, `ST_IsValid`/area checks, `GisIntegrationTest` 3/3 pass |
| Boundary versioning, no delete | IMPLEMENTED | `superseded_at` + unique current index; no-delete triggers (V12) |
| Project alignment / corridor width | IMPLEMENTED | `project_alignments`, `setAlignment`, GiST index |
| Map workspace | IMPLEMENTED | `GisMapPage` + lazy `ScopeMap` (SVG), village parcels page |
| Conflict analysis (forest/water/overlap/area/GPS) | IMPLEMENTED | `ConflictAnalyzer` deterministic findings; `ConflictWorkspacePage` |
| Satellite / Bhuvan imagery | PARTIAL | configurable OGC WMS proxy (`ImageryService`, `ImageryConfig`), disabled by default, no Bhuvan endpoint or key configured |
| Cadastral map import (BhuNaksha) | MISSING | no import endpoint, parser or reconciliation job |
| Scope-aware dashboards | IMPLEMENTED | `DashboardService` + `ReportingScope`; `DASHBOARD_READ` |
| NLAMS 5-milestone monitoring | IMPLEMENTED | `NlamsMonitoringService` (case/parcels/notification/award/possession, 20% each), `NlamsDashboardPage` |
| Report catalogue + CSV export | IMPLEMENTED | `ReportService` `DEFS`, `MAX_EXPORT_ROWS=10_000`, `REPORT_EXPORT` |
| SLA rules / scan / escalation | IMPLEMENTED | `SlaService`, `SlaScheduler` (opt-in), `sla_escalations`, in-app notification on escalation |
| Breach forecasting | IMPLEMENTED | `ForecastService`/`TimelineForecaster`, `ForecastController` |
| PDF / Excel report output | PARTIAL | CSV only; print pages exist for notices/awards but no report PDF/Excel |
| Conflict review workspace | IMPLEMENTED | `ConflictWorkspacePage.tsx` with severity, affected parcels and filter controls |

---

## M8 — Integrations & notifications — `PARTIAL`

**Backend:** `shared/notification/*`, `gis/imagery/*`, `compensation/infrastructure/SimulatedPfmsAdapter.java`
**Frontend:** `features/notifications/*`, roadmap page
**Database:** `notifications`, `notification_contacts`, `notification_deliveries`

| Capability | Status | Evidence |
|---|---|---|
| In-app notifications | IMPLEMENTED | `notifications`, `NotificationService`, `NotificationListPage`, unread count, mark-read |
| Transactional outbox + retry with backoff | IMPLEMENTED | `notification_deliveries` written in business transaction; `NotificationDispatcher` batches 25 |
| Email delivery adapter | PARTIAL | `none`/`log`/`http` adapters; default `none` = disabled |
| SMS delivery adapter | PARTIAL | same adapter model; default disabled, no phone on `users` |
| Contact details & channel preferences API/UI | MISSING | `notification_contacts` table exists; no controller or settings page |
| Delivery monitor + manual retry console | PARTIAL | backend list/retry endpoints guarded by `SETTINGS_MANAGE`; no dedicated UI |
| PFMS / DBT government payment rail | MOCK | simulated adapter only; guard blocks other modes |
| ISRO Bhuvan imagery | PARTIAL | generic WMS proxy, opt-in, unconfigured |
| BhuNaksha / Ferfar / external revenue records | MISSING | 7/12 and 8A are typed in manually; no client for any land-records service |
| OpenAPI document | IMPLEMENTED | custom `OpenApiService` + `GET /openapi.json` (3.0.3), `OpenApiServiceTest` |
| Health / info endpoints | IMPLEMENTED | actuator `health,info`; health reported `UP` |
| CI/CD automation | MISSING | no `.github/workflows`, no pipeline config |
| Container packaging | MISSING | no Dockerfile/compose |

---

## Module verdicts

| Module | Verdict | Blocking issue |
|---|---|---|
| M1 Administration & access | IMPLEMENTED | password-reset UI stale; role editing read-only |
| M2 Proposals & projects | PARTIAL | **P0**: proposal workflow fails at runtime (read-only transaction) |
| M3 Land records & documents | PARTIAL | no AV/encryption/retention/import; area not derived from geometry |
| M4 Land acquisition | PARTIAL | integration proof blocked; no statutory per-framework timelines; no server PDF |
| M5 Field surveys | PARTIAL | no mobile/offline; no survey→geometry write |
| M6 Valuation & compensation | PARTIAL | payments are simulated; no bank validation/reconciliation |
| M7 GIS, monitoring & MIS | PARTIAL | no cadastral import; imagery unconfigured; CSV-only export |
| M8 Integrations & notifications | PARTIAL | external government rails are simulated or absent |
