# Outstanding NLAMS Requirements — File-Level Checklist

Status reflects repository inspection and changes in this implementation pass. Do not treat a checked inspection item as an implemented or verified feature.

## Phase A — repository analysis

- [x] Reporting and SLA entry points: `reporting/application/DashboardService.java`, `NlamsMonitoringService.java`, `SlaService.java`, `SlaScheduler.java`; `reporting/infrastructure/DashboardRepository.java`, `SlaRepository.java`; `reporting/api/MonitoringController.java`, `SlaController.java`.
- [x] Identity and geographic models: `administration/application/UserService.java`, `GeoScopeService.java`; `administration/domain/GeographicScope.java`; `administration/api/UserController.java`, `GeoScopeController.java`; migrations V2-V4.
- [x] Routing model: `projects/application/ProposalRoutingService.java`, `RoutingRuleAdminService.java`; `projects/api/RoutingRuleController.java`; migration V17.
- [x] Seed entry points: `scripts/demo-seed-real.ps1`, `scripts/demo-seed.ps1`, `scripts/full-demo.ps1`, `scripts/demo-check.sql`, `scripts/reset-demo-db.ps1`.
- [x] Reconcile the six requested implementation areas and acceptance evidence against `FINAL_ACCEPTANCE_REPORT.md`, `DEMO_READINESS.md`, `KNOWN_ISSUES.md`, `SETUP_AND_RUN.md`, and `TESTING_AND_VERIFICATION.md`; older phase/traceability documents remain historical snapshots.

## Priority 1 — database-driven analytics

- [x] Add date, state/district, taluka, project and status filters to the existing paged MIS reports and CSV export (`ReportService`, `ReportRepository`, `MonitoringController`, `MisReportsPage`); bind filter values and retain existing geographic scope enforcement.
- [x] Add project, taluka and inclusive date filters to the main aggregate dashboard; add database-backed GIS conflict, pending-task, escalation-level and permission-gated officer-workload aggregates. District comparison remains scope-wide and is explicitly disclosed when these filters are active.
- [x] Extend main-dashboard database aggregates for parcels, acquisition, compensation estimates/payments and R&R, alongside the operational aggregates above.
- [ ] Add distinct PFMS/DBT statistics; V26 now adds an explicit simulated `payment_channel` discriminator and dashboard channel aggregates/UI, but V26 and its PostgreSQL assertions have not yet been run in this pass.
- [x] Add main dashboard status filters and apply all dashboard filters to trend, district comparison, pending tasks, escalation and channel aggregates; database consistency for the new status/channel behavior remains unverified pending V26 migration execution.
- [x] Keep MIS report loading, error, empty, pagination and CSV flows API-driven; dashboard includes loading/error/empty states and the added metric surfaces.
- [x] Apply migrations through V25 on dedicated disposable PostgreSQL/PostGIS database `landnexus_nlams_test_20261115`; filtered dashboard aggregate results were compared with direct SQL.
- [ ] Apply V26 and verify dashboard channel/status/trend/district values against direct PostgreSQL SQL. The isolated test DB settings are not present in the current environment.

## Priority 2 — scheduled SLA and escalation

- [x] Verify actual scheduled warning and breach persistence, audit rows, and repeated-scan duplicate suppression on the disposable database.
- [ ] Add configurable multi-level escalation targets and persisted per-target delivery outcomes without bypassing workflow decisions.
- [x] Expose the existing single warning/breach rule configuration and permission-gated manual scan through `/monitoring/sla`.
- [x] Exercise scheduled warning, overdue breach, and duplicate prevention against PostgreSQL; existing backend suite passed.
- [ ] Test on-time items, multilevel/named targets, unavailable officers, and missing targets (those configuration capabilities are not implemented).

## Priority 3 — users and permissions

- [x] Existing backend user listing/create/role replacement/enable/disable and immediate refresh-token revocation reviewed.
- [x] Add backend-validated, audited profile editing (email and full name) with duplicate-email and protected-SUPER_ADMIN checks; login name remains immutable.
- [x] Add V24 per-user permission overrides and `GET/PUT /api/v1/administration/users/{id}/permissions`; enforce actor authority limits, audit changes, revoke refresh tokens, and increment the authorization version.
- [x] Add V25 access-token authorization-version checks so role, permission, profile, and account-status changes invalidate previously issued tokens; targeted DB integration and authorization tests passed.
- [x] Add API-backed per-user permission editor and paginated activity/audit history screen; user page tests passed.
- [x] Prevent non-national administrators from assigning national roles and reject role grants containing permissions they do not hold; targeted privilege-boundary tests passed.
- [x] Full backend suite passed against the isolated database after V24/V25 and dashboard changes (579 tests, no failures/errors/skips). Current geographic scope remains state/division/district.
- [ ] Re-run the full backend suite after V26 and the latest role-permission token-invalidation changes; the current disposable database credentials are unavailable.
- [ ] Complete user role-assignment history, broader profile editing, and comprehensive authority/geographic enforcement for every administration API. A role-permission audit history view is now available to `AUDIT_READ` users.
- [ ] Add and verify remaining administrator features and user geographic assignments; the current user/activity/permission screens cover only existing and newly added endpoints.

## Priority 4 — hierarchical geographic administration

- [x] Existing state → division → district → taluka → village master data and parent relationships reviewed.
- [ ] Extend user scope storage/API for explicitly inherited district/taluka/village assignments; current scopes stop at state/division/district.
- [ ] Enforce effective scope in list and mutation queries for GIS, acquisition, compensation and analytics.
- [ ] Add effective-access preview and scope history UI/API; test allow/deny and revocation.

## Priority 5 — routing and SLA configuration

- [x] Existing proposal routing-rule and SLA-rule APIs/pages reviewed.
- [ ] Add rule priority/conditions and safe officer/routing targets only where backend models can enforce them.
- [ ] Extend SLA/escalation configuration API/UI with server-side validation, audit and concurrency protection.
- [ ] Test persisted configuration changes against actual routing and scheduled scans.

## Priority 6 — linked Maharashtra demo dataset

- [x] Existing synthetic Maharashtra seed and schema constraints reviewed.
- [ ] Extend a dedicated disposable-demo seed with linked GIS, compensation, simulated payment and R&R lifecycle records.
- [ ] Make repeated runs safe or explicitly run-keyed without deleting audit/history or touching shared databases.
- [ ] Report dataset counts and validate references/geometries with SQL on the disposable demo database.

## Phase E/F — verification and acceptance

- [x] Backend unit tests for changed profile/report/permission behavior (`UserServiceTest`, `UserPermissionIntegrationTest`, `SecurityEndpointsTest`, `AuthFlowIntegrationTest`, `AuthServiceTest`, `ReportServiceTest`, `ReportRepositoryTest`).
- [x] Frontend tests and production build (full suite and profile/report API coverage).
- [x] Run database integration tests and migrations through V25, execute the demo twice, check key counts/foreign keys/PostGIS validity, and compare dashboard/MIS counts with direct SQL on an explicitly disposable PostgreSQL/PostGIS database.
- [x] Re-run the complete backend suite on the isolated database after the dashboard changes; full frontend suite passed (50 files/250 tests) and production build exited successfully.
- [x] Update `DEMO_READINESS.md`, `IMPLEMENTATION_CHANGELOG.md`, `KNOWN_ISSUES.md`, `SETUP_AND_RUN.md`, `TESTING_AND_VERIFICATION.md`, `PROJECT_STATUS.md`, and `FINAL_ACCEPTANCE_REPORT.md` with measured outcomes and remaining limitations.
