# 3. Requirement Traceability Matrix — LandNexus / NLAMS

**Audit date:** 14 November 2026 · **Type:** read-only inspection + executed tests
**Status vocabulary (fixed):** `IMPLEMENTED` · `PARTIAL` · `MISSING` · `MOCK` · `UNVERIFIED`

---

## 1. Baseline and limitation (read first)

**The brief refers to 249 numbered NLAMS requirements. No document containing those 249 requirements exists in this repository or in the supplied material.**

Evidence of the absence:

- A case-insensitive repository-wide search for `249`, `functional requirement`, `NLAMS specification` across `*.md`, `*.txt`, `*.pdf`, `*.docx`, `*.xlsx`, `*.csv`, `*.json` returned no match.
- `docs/REQUIREMENTS_TRACEABILITY.md` is an older (2026-11-06) snapshot with **86** rows (`M1-01`…`X-19`) written by a previous audit that also recorded the requirements document as “supplied in chat”, with no path.
- `docs/PROJECT_PLAN.md` is plan-level prose, not a numbered requirement set.

Consequently this matrix does **not** fabricate 249 IDs. It uses a **repository-derived baseline of 127 requirements** organised into the brief’s eight modules, each phrased from documented behaviour (README, `docs/PROJECT_STATUS.md`, module docs, code, migrations, routes). IDs are this audit’s own (`M1-01`…`M8-13`).

**Traceability against the true 249-item specification is therefore `UNVERIFIED` as a whole.** If the customer supplies the specification, every row here should be re-mapped; the module/capability coverage is detailed enough to do that mechanically.

Status rule applied: `IMPLEMENTED` requires frontend surface + backend endpoint + database persistence + an execution path. Executed-test evidence overrides code reading. `MOCK` is used where a real external system is replaced by a simulator. `UNVERIFIED` is used where code exists but the audit could not establish execution (none remain in this matrix — every row has a determinate finding).

---

## 2. Matrix

### M1 — Administration, identity & access control

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M1-01 | M1 Administration | Ministry and department master data can be created, edited, activated | IMPLEMENTED | `administration/api/AdministrationController.java`; `V2__administration_master_data.sql`; `/api/v1/administration/ministries,departments`; `features/admin/master/MasterDataPage.tsx` | none | P3 |
| M1-02 | M1 Administration | Administrative geography state→division→district→taluka→village | IMPLEMENTED | 6 tables in V2; geography endpoints; cascading UI in `MasterDataPage.tsx` | none | P3 |
| M1-03 | M1 Administration | 13 government roles exist | IMPLEMENTED | `V3__security_users_roles.sql` `INSERT INTO roles` (13 rows); verified on disposable DB | none | P3 |
| M1-04 | M1 Administration | Fine-grained permission catalogue mapped to roles | IMPLEMENTED | permission inserts across V3–V17 (~60 codes); `role_permissions` table | none | P3 |
| M1-05 | M1 Administration | Every backend endpoint is permission-checked | IMPLEMENTED | `@PreAuthorize` in 35 files; all controllers except `AuthController` (public login/refresh/logout) | `/me` relies on `isAuthenticated` only, by design | P2 |
| M1-06 | M1 Administration | Frontend routes are permission-gated | IMPLEMENTED | 85 `RequirePermission` usages in `src/app/router.tsx` | none | P2 |
| M1-07 | M1 Administration | Users can be created, assigned roles, enabled/disabled | IMPLEMENTED | `UserController` POST, PUT `/{id}/roles`, POST `/{id}/enable|disable`; `UsersPage.tsx` | none | P2 |
| M1-08 | M1 Administration | Roles and their permissions can be administered | PARTIAL | `GET /api/v1/administration/roles` only; `RoleController.java`; `RolesPage.tsx` is read-only | no create/update role or permission-mapping API/UI | P1 |
| M1-09 | M1 Administration | Login, refresh, logout, current-user | IMPLEMENTED | `AuthController`; `AuthService`; `AuthFlowIntegrationTest` 8/8 pass | none | P0 |
| M1-10 | M1 Administration | Refresh tokens rotate; reuse ends all sessions | IMPLEMENTED | `AuthService` rotation + reuse detection; `refresh_tokens` table; integration-tested | none | P1 |
| M1-11 | M1 Administration | Account locks after repeated failed logins | IMPLEMENTED | `AuthService.MAX_FAILED_ATTEMPTS=5`, `LOCK_DURATION=15m`; `users.locked_until` | none | P1 |
| M1-12 | M1 Administration | Password policy enforced; change password | IMPLEMENTED | `shared/validation/PasswordPolicy.java`; `PasswordService.changePassword`; `POST /api/v1/auth/change-password` | one test expectation is wrong (see Testing report) | P1 |
| M1-13 | M1 Administration | Admin-issued one-time password reset code | IMPLEMENTED | `PasswordService.issueReset`; `POST /api/v1/administration/users/{id}/password-reset`; `password_reset_tokens`; `V15`; 192-bit code, SHA-256, 60 min | none | P1 |
| M1-14 | M1 Administration | Self-service forgot-password UI | PARTIAL | backend `POST /api/v1/auth/reset-password` exists; `features/auth/ForgotPasswordPage.tsx` still shows “Password reset is not available yet” | UI not wired to existing backend | P0 |
| M1-15 | M1 Administration | Audit trail is appended, immutable and viewable | IMPLEMENTED | `audit_events` + `trg_audit_events_append_only` (V4); `AuditService`; `AuditTrailPage.tsx` | none | P1 |
| M1-16 | M1 Administration | Login history is appended, immutable and viewable | IMPLEMENTED | `login_history` + trigger (V4); `AuthService`; `LoginHistoryPage.tsx` | none | P2 |
| M1-17 | M1 Administration | Geographic scope limits data by user posting | IMPLEMENTED | `user_geographic_scopes`, `GeoScopeService`, `ReportingScope`; `AuditAndScopeIntegrationTest` 6/6 pass | none | P1 |
| M1-18 | M1 Administration | IP-based rate limiting on authentication | IMPLEMENTED | `shared/security` limiter + `RateLimiterTest` passing | in-memory only, not cluster-safe | P2 |
| M1-19 | M1 Administration | Multi-factor authentication or government SSO | MISSING | no TOTP/WebAuthn/OIDC code, config or UI found | not started | P2 |
| M1-20 | M1 Administration | Citizen self-registration / public portal identity | MISSING | users only created by admins (`UserController` POST); no signup route | not started | P3 |

### M2 — Proposals & government projects

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M2-01 | M2 Proposals | Consultant can draft and edit a proposal | IMPLEMENTED | `ProposalController` POST/PUT; `ProposalService.create/update` (`@Transactional`); `ProposalFormPage.tsx` | none | P1 |
| M2-02 | M2 Proposals | Proposal consistency is validated before submit | IMPLEMENTED | `ProposalValidationService`; DB CHECKs in `V5__proposals_projects_notifications.sql` | none | P1 |
| M2-03 | M2 Proposals | Submitting allocates a unique sequential proposal number | PARTIAL | `proposal_number_seq`, CHECK `status='DRAFT' OR proposal_number IS NOT NULL` | runtime failure `cannot execute nextval() in a read-only transaction` (14×) — P0-1 | P0 |
| M2-04 | M2 Proposals | Scrutiny, clarification request and resubmission | PARTIAL | `ProposalWorkflow` transitions; `ProposalService.transition` (line 217, not `@Transactional`) | same read-only transaction defect blocks all transitions | P0 |
| M2-05 | M2 Proposals | Officer can recommend; recommender cannot approve | PARTIAL | `ProposalWorkflow` authority + separation check; `ProposalServiceTest` (45 unit tests) | integration execution fails; no end-to-end proof | P0 |
| M2-06 | M2 Proposals | Approval creates exactly one project and one acquisition case | PARTIAL | `ProposalService.approveWithRecovery`; `AcquisitionCaseInitiator`; `uq_acquisition_cases_project` | `ProposalApprovalReliabilityIntegrationTest` 6/6 fail at fixture (P1-3) | P0 |
| M2-07 | M2 Proposals | Rejection needs a reason; owner can reopen keeping the number | PARTIAL | `ProposalService.reject` (line 226); `REOPEN` transition; history rows | blocked by read-only transaction defect | P0 |
| M2-08 | M2 Proposals | Proposal history and versions are retained immutably | IMPLEMENTED | `proposal_status_history`, `proposal_versions`; append-only function from `V4` | none | P2 |
| M2-09 | M2 Proposals | Workflow actions require the matching role authority | IMPLEMENTED | `shared/workflow/WorkflowDefinition.java` (authority + reason enforced); `Transition` definitions | not exercised end-to-end due to P0-1 | P1 |
| M2-10 | M2 Proposals | Routing rules decide the next desk on submit | PARTIAL | `routing_rules` seeded (V17); `ProposalRoutingService`; `ROUTING_RULE_MANAGE` permission exists | no admin API or UI to manage rules | P2 |
| M2-11 | M2 Proposals | Assignments and “my tasks” worklist | IMPLEMENTED | `proposal_assignments` (V17); `GET /api/v1/projects/proposals/my-tasks`; `MyWorkPage.tsx` | none | P2 |
| M2-12 | M2 Projects | Project list and detail scoped to the caller | IMPLEMENTED | `ProjectController`; `ProjectService.get/list`; `ProjectListPage.tsx`, `ProjectDetailsPage.tsx` | none | P2 |
| M2-13 | M2 Projects | Project can be edited or closed | MISSING | `ProjectService` exposes only `get`/`list`; `projects.status` CHECK allows `CLOSED` but no endpoint | no update/close API or UI | P1 |
| M2-14 | M2 Projects | Duplicate projects/cases cannot be created | IMPLEMENTED | `uq_acquisition_cases_project` (V16) verified present; duplicate-safe creation in commit `94875ea` | none | P0 |
| M2-15 | M2 Proposals | Workflow events raise in-app notifications | IMPLEMENTED | `ProposalService` calls `NotificationService.notify`; `notifications` table | none | P2 |
| M2-16 | M2 Proposals | Consultant sees own proposals; officers see their scope | IMPLEMENTED | `ProposalAccess.canView`; `PROPOSAL_READ_OWN`; asserted in `ProposalWorkflowIntegrationTest` | assertion blocked by fixture (P1-3) | P1 |
| M2-17 | M2 Proposals | Proposal list filters and paginates | IMPLEMENTED | `GET /api/v1/projects/proposals?status&districtId&page&size`; `PageResponse` | none | P3 |
| M2-18 | M2 Proposals | Supporting documents can be attached to a proposal | MISSING | `land_documents.parcel_id` is the only document owner; no proposal document model | not started | P2 |

### M3 — Land records & supporting documents

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M3-01 | M3 Land records | Parcel CRUD with unique gat/survey/subdivision per village | IMPLEMENTED | `ParcelService.create/update/setStatus`; `ParcelController`; `ParcelServiceTest` 9/9 pass; unique constraint | none | P1 |
| M3-02 | M3 Land records | Parcel classification, land use and lifecycle status | IMPLEMENTED | `LandTypes` enums; DB CHECKs; `ParcelFormPage.tsx` | none | P2 |
| M3-03 | M3 Land records | Landowner registry with identity details | IMPLEMENTED | `LandownerService`; `landowners` table; `LandownerListPage.tsx` | none | P2 |
| M3-04 | M3 Land records | Ownership records with basis and share | IMPLEMENTED | `parcel_ownerships`; `OwnershipService`; `OwnershipServiceTest` 10/10 pass | none | P1 |
| M3-05 | M3 Land records | Ownership mutation history | IMPLEMENTED | `parcel_mutations`; append-only handling in `OwnershipService` | none | P2 |
| M3-06 | M3 Land records | 7/12 extract can be recorded (manual entry) | IMPLEMENTED | `RevenueRecordType.SEVEN_TWELVE`; `revenue_records`; parcel details UI | manual only — no external fetch | P1 |
| M3-07 | M3 Land records | 8A record can be recorded; khata required | IMPLEMENTED | `EIGHT_A` branch with khata requirement; DB CHECK; parcel details UI | manual only | P1 |
| M3-08 | M3 Land records | Documents upload with type/size validation | IMPLEMENTED | `DocumentService.create`; `FileValidator` (magic bytes PDF/JPEG/PNG, ≤10 MB); `UploadDocumentDialog` | no malware scan | P1 |
| M3-09 | M3 Land records | Document versions are retained immutably | IMPLEMENTED | `land_document_versions`; append-only trigger (V4/V7); `DocumentService.addVersion` | none | P2 |
| M3-10 | M3 Land records | Documents are verified by a second officer | IMPLEMENTED | `DocumentService.verify/reject`; `DOCUMENT_VERIFY`; verification fields in V7 | none | P1 |
| M3-11 | M3 Land records | Document download is authorised and audited | IMPLEMENTED | `DocumentService.download`; `FileStorage`; `LocalFileStorageTest` 5/5 pass | none | P1 |
| M3-12 | M3 Land records | Parcel area is derived from the surveyed geometry | PARTIAL | `land_parcels.area_ha` operator-entered; `parcel_boundaries.area_ha` computed by PostGIS, never reconciled | no area-derivation/reconciliation rule | P1 |
| M3-13 | M3 Land records | Uploaded files are scanned for malware | MISSING | `FileValidator` comment: “No virus scanner in this prototype” | not started | P1 |
| M3-14 | M3 Land records | Stored documents are encrypted at rest | MISSING | `LocalFileStorage` writes plain `.bin` files under a local directory | not started | P2 |
| M3-15 | M3 Land records | Document retention and legal hold | MISSING | no retention field, job or policy | not started | P3 |
| M3-16 | M3 Land records | Bulk import of land records | MISSING | no CSV/Excel import endpoint or page | not started | P3 |

### M4 — Land acquisition lifecycle

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M4-01 | M4 Acquisition | Case is created from an approved project | PARTIAL | `CaseLifecycleService.create`; `AcquisitionCaseInitiator` | integration proof blocked by broken fixtures (P1-3) | P0 |
| M4-02 | M4 Acquisition | Only one acquisition case per project | IMPLEMENTED | `uq_acquisition_cases_project` (V16) verified on DB; 0 duplicate groups on dev | none | P0 |
| M4-03 | M4 Acquisition | Case follows a fixed legal state machine | IMPLEMENTED | `AcquisitionTypes.CaseStatus` (9 states); `CaseLifecycleService`; `InvalidTransitionException` | none | P0 |
| M4-04 | M4 Acquisition | Case villages can be assigned | IMPLEMENTED | `PUT /api/v1/acquisition/cases/{id}/villages`; `case_villages` | none | P1 |
| M4-05 | M4 Acquisition | Case parcels can be added/removed and owners assigned | IMPLEMENTED | `POST/DELETE /cases/{id}/parcels`, `POST .../assign`; `case_parcels`, `case_parcel_owners` | none | P1 |
| M4-06 | M4 Acquisition | Field officers can be assigned and see their work | IMPLEMENTED | `GET /api/v1/acquisition/my-assignments`; `MySurveysPage.tsx` | none | P1 |
| M4-07 | M4 Acquisition | Surveys are submitted, verified or rejected | IMPLEMENTED | `SurveyService`; `/surveys`, `/surveys/{id}/verify|reject`; `SURVEY_PERFORM/VERIFY` | none | P1 |
| M4-08 | M4 Acquisition | Verification report is produced per case | IMPLEMENTED | `GET /api/v1/acquisition/cases/{id}/verification-report` | none | P2 |
| M4-09 | M4 Acquisition | Legal notices are issued, registered and printable | IMPLEMENTED | `legal_notices`; `/notices`, `/issue-notification`; `NoticesRegisterPage.tsx`, `NoticePrintPage.tsx` | print is browser-side | P1 |
| M4-10 | M4 Acquisition | Objections can be filed, decided and the window closed | IMPLEMENTED | `objections`; `/objections`, `/objections/{id}/decide`, `/close-objection-window` | none | P1 |
| M4-11 | M4 Acquisition | Award is declared with parcel-wise detail | IMPLEMENTED | `acquisition_awards`, `award_parcels`; `AwardPrintPage.tsx` | print is browser-side | P1 |
| M4-12 | M4 Acquisition | Possession (physical/deemed) is recorded | IMPLEMENTED | `possession_records`; `/complete-possession`; `PossessionType` enum | none | P1 |
| M4-13 | M4 Acquisition | Cases can be cancelled with reason | IMPLEMENTED | `POST /cases/{id}/cancel`; `CANCELLED` state | none | P2 |
| M4-14 | M4 Acquisition | Case status history is immutable | IMPLEMENTED | `acquisition_case_history` + append-only trigger (V4); `CaseStatusHistory` | none | P2 |
| M4-15 | M4 Acquisition | The correct legal framework is captured per case | IMPLEMENTED | `AcquisitionFramework` (LARR_2013, NH_1956, Railways_1989, STATE_ACT, OTHER) persisted | no framework-specific rule engine | P1 |
| M4-16 | M4 Acquisition | Framework-specific statutory timelines are enforced | PARTIAL | generic `sla_rules` + escalation exist; no per-framework legal duration model/validation | no statutory calendar | P1 |
| M4-17 | M4 Acquisition | Case can be closed after possession | IMPLEMENTED | `CLOSED` terminal state via possession completion; verified dev data has 11 closed cases | none | P2 |
| M4-18 | M4 Acquisition | Notices/awards are exported as signed PDF documents | PARTIAL | print pages render HTML for browser print; no server-side PDF or digital signature | no document generation service | P2 |

### M5 — Field surveys

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M5-01 | M5 Surveys | Survey record captures parcel, date and officer | IMPLEMENTED | `field_surveys`; `SurveyService.submit`; `SurveyFormPage.tsx` | none | P1 |
| M5-02 | M5 Surveys | GPS coordinates are captured and range-validated | IMPLEMENTED | latitude/longitude validation; used by `ConflictAnalyzer` GPS checks | manual entry, no device GPS feed | P2 |
| M5-03 | M5 Surveys | Survey measurements/area are recorded | IMPLEMENTED | survey fields in `field_surveys`; area comparison in conflict analysis | none | P2 |
| M5-04 | M5 Surveys | Survey photographs are stored immutably | IMPLEMENTED | `survey_photos` + append-only trigger; `SurveyPhotoService` | none | P2 |
| M5-05 | M5 Surveys | Survey verification workflow | IMPLEMENTED | `SUBMITTED/VERIFIED/REJECTED`; verify/reject endpoints | none | P1 |
| M5-06 | M5 Surveys | Rejected survey can be reworked and resubmitted | IMPLEMENTED | new survey submission for the same case parcel; latest status drives UI | none | P1 |
| M5-07 | M5 Surveys | Survey geometry updates the parcel boundary | PARTIAL | `parcel_boundaries` entered separately by GIS officers; no automatic survey→boundary write | two unlinked geometry sources | P1 |
| M5-08 | M5 Surveys | Mobile/offline survey capture | MISSING | responsive web form only; no PWA/offline queue | not started | P2 |
| M5-09 | M5 Surveys | Survey teams, equipment and instrument calibration | MISSING | no tables, endpoints or UI | not started | P3 |
| M5-10 | M5 Surveys | Survey stage SLA and duration analytics | IMPLEMENTED | `rpt_stage_durations` (V15); `SlaService`; monitoring UI | none | P2 |

### M6 — Valuation & compensation

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M6-01 | M6 Compensation | Market-value rate cards per village/classification | IMPLEMENTED | `RateService`; `market_value_rates`; `RateRulesPage.tsx` | none | P1 |
| M6-02 | M6 Compensation | Rate cards are approved before use | IMPLEMENTED | `PENDING/APPROVED/REJECTED`; `RATE_APPROVE`; `RateService.approve/reject` | none | P1 |
| M6-03 | M6 Compensation | Ordered rule sets and components define calculations | IMPLEMENTED | `valuation_rule_sets`, `rule_set_components` + append-only trigger; `RuleSetDetailPage.tsx` | none | P1 |
| M6-04 | M6 Compensation | Rule sets can be approved and retired | IMPLEMENTED | `DRAFT/APPROVED/RETIRED`; `RULESET_APPROVE`; `RuleSetService` | none | P2 |
| M6-05 | M6 Compensation | Deterministic valuation engine | IMPLEMENTED | `CompensationEngine` (LAND_VALUE, ASSET_VALUE, PERCENT_OF, FIXED_PER_HECTARE); unit-tested | none | P0 |
| M6-06 | M6 Compensation | Valuations submit, approve, reject | IMPLEMENTED | `ValuationService`; `VALUATION_APPROVE`; `CompensationIntegrationTest` 5/5 pass | none | P0 |
| M6-07 | M6 Compensation | Valuation lines show each component amount | IMPLEMENTED | `valuation_lines`; `ValuationDetailPage.tsx` | none | P2 |
| M6-08 | M6 Compensation | Payments are generated from approved valuations | IMPLEMENTED | `PaymentService.generate`; `PaymentSplitter`; `compensation_payments` | none | P0 |
| M6-09 | M6 Compensation | Payments are released by an authorised officer | IMPLEMENTED | `PaymentService.release`; `PAYMENT_RELEASE`; `payment_events` | none | P0 |
| M6-10 | M6 Compensation | Payment event history is immutable | IMPLEMENTED | `payment_events` + append-only trigger; `PaymentService.eventsOf` | none | P2 |
| M6-11 | M6 Compensation | Payment is split across multiple owners | IMPLEMENTED | `PaymentSplitter`; owner shares from `case_parcel_owners` | none | P1 |
| M6-12 | M6 Compensation | Compensation summary per case | IMPLEMENTED | `PaymentService.summary`; `rpt_compensation` view; compensation dashboard page | none | P2 |
| M6-13 | M6 Compensation | R&R benefit catalogue | IMPLEMENTED | `rr_benefit_types`; `RrService`; `BenefitCataloguePage.tsx` | none | P2 |
| M6-14 | M6 Compensation | R&R cases and entitlements | IMPLEMENTED | `rr_cases`, `rr_entitlements`; `RrCaseDetailPage.tsx` | none | P2 |
| M6-15 | M6 Compensation | R&R entitlements can be approved, delivered, completed | IMPLEMENTED | `RrService` transitions; `RR_APPROVE` | none | P2 |
| M6-16 | M6 Compensation | Disbursement through PFMS/DBT | MOCK | `compensation/infrastructure/SimulatedPfmsAdapter.java` returns `SIM-PFMS-…`; `PaymentModeGuard` refuses other modes | no real PFMS/DBT connectivity | P1 |
| M6-17 | M6 Compensation | Beneficiary bank/IFSC validation | MISSING | no bank account model, validation endpoint or UI | not started | P1 |
| M6-18 | M6 Compensation | Settlement and reconciliation feed | MISSING | no reconciliation table, job or endpoint | not started | P2 |

### M7 — GIS, monitoring & MIS

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M7-01 | M7 GIS & MIS | Parcel boundaries can be entered and validated spatially | IMPLEMENTED | `GisService.setParcelBoundary`; GeoJSON body; PostGIS validation; `GisIntegrationTest` 3/3 pass | none | P1 |
| M7-02 | M7 GIS & MIS | Boundary versions are retained, never deleted | IMPLEMENTED | `parcel_boundaries` with `superseded_at`; unique-current index; no-delete triggers (V12) | none | P1 |
| M7-03 | M7 GIS & MIS | Project alignment/corridor is stored spatially | IMPLEMENTED | `project_alignments`; GiST index; `setAlignment` endpoint | none | P1 |
| M7-04 | M7 GIS & MIS | Map workspace shows scope, parcels and corridors | IMPLEMENTED | `GisMapPage.tsx`, lazy `ScopeMap.tsx`, `VillageParcelsPage.tsx` | custom SVG, no basemap tiles | P2 |
| M7-05 | M7 GIS & MIS | Conflict analysis covers forest/water/overlap/area/GPS | IMPLEMENTED | `gis/application/ConflictAnalyzer.java` (deterministic findings), `GisReportRepository` SQL | no legal determination engine | P1 |
| M7-06 | M7 GIS & MIS | Conflict findings have a review workspace | IMPLEMENTED | `ConflictWorkspacePage.tsx`; severity + affected parcels API | none | P2 |
| M7-07 | M7 GIS & MIS | ISRO Bhuvan satellite/thematic imagery | PARTIAL | `gis/imagery/ImageryService.java` + `ImageryConfig` generic OGC WMS proxy; disabled by default | no Bhuvan endpoint, key, attribution or licence configured | P1 |
| M7-08 | M7 GIS & MIS | Cadastral maps/boundaries imported (BhuNaksha) | MISSING | no import endpoint, parser or reconciliation job | not started | P2 |
| M7-09 | M7 GIS & MIS | Scope-aware dashboards | IMPLEMENTED | `DashboardService` + `ReportingScope`; `DASHBOARD_READ`; monitoring home page | none | P2 |
| M7-10 | M7 GIS & MIS | NLAMS five-milestone progress | IMPLEMENTED | `NlamsMonitoringService` (case/parcels/notification/award/possession, 20% each); `NlamsDashboardPage.tsx` | none | P2 |
| M7-11 | M7 GIS & MIS | Report catalogue with CSV export | IMPLEMENTED | `ReportService` (10k row cap); `REPORT_EXPORT`; `ReportsPage.tsx` | CSV only | P2 |
| M7-12 | M7 GIS & MIS | SLA rules, scanning and escalation | IMPLEMENTED | `SlaService`, `SlaScheduler` (opt-in `LANDNEXUS_SLA_SCHEDULER`), `sla_escalations`, in-app notification | no manual scan trigger in UI | P1 |
| M7-13 | M7 GIS & MIS | Breach forecasting | IMPLEMENTED | `ForecastService`, `TimelineForecaster`, `ForecastController` | statistical only, no ML | P3 |
| M7-14 | M7 GIS & MIS | Reports export as PDF/Excel | PARTIAL | CSV export only; browser print pages exist for notices/awards | no PDF/Excel renderer | P2 |

### M8 — Integrations, notifications & delivery platform

| Requirement ID | Module | Requirement | Status | Evidence/File/API | Gap | Priority |
|---|---|---|---|---|---|---|
| M8-01 | M8 Integrations | In-app notifications with unread count and mark-read | IMPLEMENTED | `NotificationService`, `NotificationController`; `NotificationListPage.tsx` | none | P1 |
| M8-02 | M8 Integrations | Transactional outbox with bounded retries | IMPLEMENTED | `notification_deliveries` (V19); `NotificationDispatcher` (batch 25, backoff); delivery attempt service | none | P1 |
| M8-03 | M8 Integrations | Email delivery channel | PARTIAL | `none`/`log`/`http` adapters; default `DisabledNotificationAdapter` (`none`) | no SMTP/provider configured; disabled by default | P2 |
| M8-04 | M8 Integrations | SMS delivery channel | PARTIAL | same adapter model; SMS disabled by default; no phone on `users` | no gateway configured | P2 |
| M8-05 | M8 Integrations | Users manage contact details and channel preferences | MISSING | `notification_contacts` table exists; no controller, API or page | table unused by UI | P1 |
| M8-06 | M8 Integrations | Operators can monitor and retry deliveries | PARTIAL | delivery list/retry endpoints guarded by `SETTINGS_MANAGE`; `NotificationDeliveryService` | no dedicated delivery console UI | P2 |
| M8-07 | M8 Integrations | PFMS/DBT payment rail | MOCK | `SimulatedPfmsAdapter`; mode `SIMULATED` only | simulated, not a government rail | P1 |
| M8-08 | M8 Integrations | ISRO Bhuvan imagery service | PARTIAL | generic configurable WMS proxy, opt-in | unconfigured | P1 |
| M8-09 | M8 Integrations | BhuNaksha / Ferfar / external revenue records | MISSING | 7/12 and 8A are manual; no service client of any kind | not started | P2 |
| M8-10 | M8 Integrations | Machine-readable API contract | IMPLEMENTED | `shared/openapi/OpenApiService.java`, `MetaController` `GET /openapi.json` (3.0.3); `OpenApiServiceTest` | no Swagger UI | P2 |
| M8-11 | M8 Integrations | Health and info endpoints | IMPLEMENTED | actuator `health,info` in `application.properties`; health reported `UP` | no metrics/tracing | P2 |
| M8-12 | M8 Integrations | Automated CI build/test pipeline | MISSING | no `.github/workflows`, no pipeline config in repo | not started | P1 |
| M8-13 | M8 Integrations | Container packaging for deployment | MISSING | no `Dockerfile`/`docker-compose.yml` | not started | P2 |

---

## 3. Per-module totals (from the matrix above)

| Module | Rows | IMPLEMENTED | PARTIAL | MOCK | MISSING |
|---|---|---|---|---|---|
| M1 Administration | 20 | 16 | 2 | 0 | 2 |
| M2 Proposals & projects | 18 | 10 | 6 | 0 | 2 |
| M3 Land records | 16 | 11 | 1 | 0 | 4 |
| M4 Acquisition | 18 | 15 | 3 | 0 | 0 |
| M5 Surveys | 10 | 7 | 1 | 0 | 2 |
| M6 Compensation | 18 | 15 | 0 | 1 | 2 |
| M7 GIS & MIS | 14 | 11 | 2 | 0 | 1 |
| M8 Integrations | 13 | 4 | 4 | 1 | 4 |
| **Total** | **127** | **89** | **19** | **2** | **17** |

**Percentages:** IMPLEMENTED 70.1 % · PARTIAL 15.0 % · MOCK 1.6 % · MISSING 13.4 %.
“Delivered to some degree” (IMPLEMENTED + PARTIAL + MOCK) = 86.6 %.

---

## 4. Rows that would change status if the P0/P1 defects were fixed

| Row | Current | Would become | Dependency |
|---|---|---|---|
| M2-03, M2-04, M2-05, M2-07 | PARTIAL | IMPLEMENTED | fix `ProposalService.transition/reject` transaction (P0-1) |
| M2-06, M4-01 | PARTIAL | IMPLEMENTED / UNVERIFIED | fix integration fixtures (P1-3) |
| M1-14 | PARTIAL | IMPLEMENTED | wire `ForgotPasswordPage` to existing endpoints |

If only P0-1 is fixed, IMPLEMENTED rises from 89 to at least 93 (73.2 %).
