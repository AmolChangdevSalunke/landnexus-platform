# 5. Database & API Audit — LandNexus / NLAMS

**Audit date:** 14 November 2026
**Method:** Flyway migrations inspected; schema applied to a **disposable** PostgreSQL database `landnexus_audit_it` and queried with `psql`; backend sources scanned for every endpoint.
**Safety:** the real dev database `landnexus_dev` was **not** used for destructive checks. It was only read to confirm committed data state (13 cases, 105 history rows, 0 duplicate groups).

---

## PART A — DATABASE

## 1. Inventory (measured on `landnexus_audit_it`, PostgreSQL 18.6 + PostGIS)

| Object | Count | Notes |
|---|---|---|
| Base tables | 64 | 62 application tables + `spatial_ref_sys` + `flyway_schema_history` |
| Views | 8 | 6 business views + `geography_columns`, `geometry_columns` (PostGIS) |
| Indexes | 170 | includes PK, unique, FK-supporting and 2 GiST spatial indexes |
| Foreign keys | 116 | referential integrity enforced in the database, not only JPA |
| CHECK constraints | 543 | unusually strong for a prototype (state, type and numeric guards) |
| UNIQUE constraints | 45 | plus partial unique indexes |
| Flyway migrations | 19 | V1…V19, all applied successfully, no failures |

Business views: `rpt_cases`, `rpt_compensation`, `rpt_project_progress`, `rpt_projects`, `rpt_sla_items`, `rpt_stage_durations`.

## 2. Table groups

| Domain | Tables |
|---|---|
| Administration | `ministries`, `departments`, `states`, `divisions`, `districts`, `talukas`, `villages` |
| Identity & security | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `refresh_tokens`, `password_reset_tokens`, `user_geographic_scopes`, `audit_events`, `login_history` |
| Proposals & projects | `proposals`, `proposal_villages`, `proposal_versions`, `proposal_status_history`, `proposal_assignments`, `routing_rules`, `projects`, `project_villages` |
| Land records | `land_parcels`, `landowners`, `parcel_ownerships`, `parcel_mutations`, `revenue_records`, `land_documents`, `land_document_versions` |
| Acquisition | `acquisition_cases`, `case_villages`, `case_parcels`, `case_parcel_owners`, `acquisition_case_history`, `field_surveys`, `survey_photos`, `legal_notices`, `objections`, `acquisition_awards`, `award_parcels`, `possession_records`, `asset_records` |
| Compensation | `market_value_rates`, `valuation_rule_sets`, `rule_set_components`, `valuations`, `valuation_lines`, `compensation_payments`, `payment_events`, `rr_benefit_types`, `rr_cases`, `rr_entitlements` |
| GIS | `parcel_boundaries`, `project_alignments` |
| Reporting / ops | `sla_rules`, `sla_escalations`, `notifications`, `notification_contacts`, `notification_deliveries` |

## 3. Integrity design — what is genuinely good

| Control | Evidence | Assessment |
|---|---|---|
| State values constrained in DB, not only Java | e.g. `ck_proposals_status`, `ck_projects_status`, `ck_docs_status`; 543 CHECKs total | IMPLEMENTED |
| Business invariants in DB | `ck_proposals_dates` (`planned_end_date > planned_start_date`), `ck_proposals_length`, `ck_proposals_land`, `ck_proposals_number_after_submit` | IMPLEMENTED |
| One acquisition case per project | `uq_acquisition_cases_project` (V16) | IMPLEMENTED |
| One open assignment per proposal/stage | `uq_assignment_open_stage` partial unique index (V17) | IMPLEMENTED |
| One current boundary version per parcel | `uq_boundary_current ... WHERE superseded_at IS NULL` (V12) | IMPLEMENTED |
| Append-only/immutable history | Triggers confirmed on `audit_events`, `login_history`, `proposal_status_history`, `proposal_versions`, `land_document_versions`, `acquisition_case_history`, `survey_photos`, `payment_events`, `sla_escalations`, `rule_set_components` | IMPLEMENTED |
| Spatial indexing | `idx_boundary_geom`, alignment geometry GiST (V12) | IMPLEMENTED |
| Transactional audit | `AuditService` writes inside the caller’s transaction | IMPLEMENTED |
| Referential integrity | 116 FKs; duplicate-safe creation path | IMPLEMENTED |

## 4. Data-model risks and gaps

| # | Finding | Severity | Evidence |
|---|---|---|---|
| D1 | `land_parcels.area_ha` (manual) and `parcel_boundaries.area_ha` (PostGIS-computed) can disagree with no reconciliation | HIGH | `V6`, `V12`; `GisService` computes boundary area independently |
| D2 | Proposal numbers come from `proposal_number_seq`; a rolled-back submit burns a number, leaving gaps | MEDIUM | sequence usage in `ProposalService`; expected for sequences, but “sequential” claims in docs are approximate |
| D3 | `notification_contacts` exists but has no API/UI; contact data is effectively unused | MEDIUM | table in V19; only `NotificationContactRepository` references it |
| D4 | No partitioning for high-volume tables (`audit_events`, `login_history`, `notifications`, `proposal_status_history`) | MEDIUM | DDL has no `PARTITION BY` |
| D5 | No soft-delete or archival policy; several tables are permanent by design, others cascade | MEDIUM | mixed FK actions; no retention columns |
| D6 | No encryption at rest for PII (landowner identity, contacts) or files | HIGH | plain columns; `LocalFileStorage` writes plain files |
| D7 | No row-level security / tenant isolation at DB level; all isolation is application-side (`GeoScopeService`) | HIGH for multi-tenant deployment | no RLS policies |
| D8 | `users` has no phone, while SMS is a supported channel | LOW | V3 schema; V19 comment acknowledges it |
| D9 | No DB backup/PITR configuration in repo | MEDIUM | no ops artefacts |
| D10 | Migration set is forward-only (correct for Flyway) but no documented rollback/restore drill | LOW | `docs/SETUP_AND_RUN.md` only |

## 5. Verified data state (read-only)

- `landnexus_audit_it`: 19/19 migrations applied; 64 tables; all views created.
- `landnexus_dev` (not modified): 13 acquisition cases (11 `CLOSED`, 2 `INITIATED`), 105 case-history rows, 13 `case_villages`, **0 duplicate case groups** for the unique project constraint, 15 `MERGE_DUPLICATE` audit rows, Flyway at V19, trigger enabled.

## 6. Database verdict

**IMPLEMENTED** as a schema design; **PARTIAL** as a production data platform (no RLS, encryption, partitioning, retention, backup automation, or area reconciliation).

---

## PART B — API

## 7. Surface inventory

33 controllers, **205 endpoint mappings**, all under `/api/v1` except `PasswordController` (method-level paths under `/api/v1/auth` / administration).

| Area | Controller | Base path | Endpoints |
|---|---|---|---|
| Auth | `AuthController` | `/api/v1/auth` | 4 |
| Password | `PasswordController` | `/api/v1/auth`, admin | 3 |
| Users | `UserController` | `/api/v1/administration/users` | 6 |
| Roles | `RoleController` | `/api/v1/administration/roles` | 1 |
| Audit | `AuditController` | `/api/v1/administration` | 2 |
| Geo scope | `GeoScopeController` | `/api/v1/administration` | 3 |
| Master data | `Ministry/Department/State/Division/District/Taluka/VillageController` | `/api/v1/administration/...` | 6 each (42) |
| Proposals | `ProposalController` | `/api/v1/projects/proposals` | 17 |
| Projects | `ProjectController` | `/api/v1/projects` | 2 |
| Land records | `ParcelController` | `/api/v1/land-records/parcels` | 6 |
| Parcel sub-resources | `ParcelRecordsController` | `/api/v1/land-records/parcels/{parcelId}` | 7 |
| Landowners | `LandownerController` | `/api/v1/land-records/landowners` | 4 |
| Documents | `DocumentController` | `/api/v1/land-records` | 7 |
| Acquisition | `AcquisitionController` | `/api/v1/acquisition` | 18 |
| Acquisition lifecycle | `AcquisitionLifecycleController` | `/api/v1/acquisition/cases/{caseId}` | 16 |
| Compensation | `CompensationController` | `/api/v1/compensation` | 19 |
| Payments | `PaymentController` | `/api/v1/compensation` | 6 |
| R&R | `RrController` | `/api/v1/compensation` | 9 |
| GIS | `GisController` | `/api/v1/gis` | 8 |
| GIS conflicts | `GisConflictController` | `/api/v1/gis/projects/{projectId}` | 2 |
| Imagery | `ImageryController` | `/api/v1/gis/imagery` | 4 |
| Monitoring | `MonitoringController` | `/api/v1/monitoring` | 5 |
| SLA | `SlaController` | `/api/v1/monitoring` | 6 |
| Forecast | `ForecastController` | `/api/v1/monitoring` | 1 |
| Notifications | `NotificationController` | `/api/v1/notifications` | 3 |
| Delivery admin | `NotificationDeliveryController` | `/api/v1/notifications/deliveries` | 3 |
| Meta | `MetaController` | `/api/v1/meta` | 1 (`/openapi.json`) |

**Total: 205.** Verified by counting `@GetMapping/@PostMapping/@PutMapping/@PatchMapping/@DeleteMapping` across all `*Controller.java`.

## 8. API design quality

| Concern | Status | Evidence |
|---|---|---|
| Consistent URL versioning | IMPLEMENTED | `/api/v1/...` everywhere |
| Consistent success envelope | IMPLEMENTED | DTOs + `PageResponse<T>` for lists |
| Consistent error envelope | IMPLEMENTED | `shared/response/ApiError`; `ApiExceptionHandler` maps validation→400, auth→401, denied→403, missing→404, conflict/optimistic-lock→409, unexpected→500 |
| No internal detail leakage on 500 | IMPLEMENTED | handler logs internally, returns generic `ApiError` (verified by reading handler) |
| Bean validation at the edge | IMPLEMENTED | 70 `@Valid` usages, 124 constraint annotations |
| Permission checks on endpoints | IMPLEMENTED | `@PreAuthorize` on all controllers except `AuthController` |
| Pagination with caps | IMPLEMENTED | `page`/`size` on lists; `ReportService.MAX_PAGE_SIZE = 200`; CSV cap 10 000 rows |
| File upload limits and content sniffing | IMPLEMENTED | `FileValidator` magic bytes, 10 MB default (`landnexus.storage.max-file-bytes`) |
| Idempotency keys on POST | MISSING | no `Idempotency-Key` handling; duplicate-submit protection relies on state machine + unique constraints |
| Rate limiting | PARTIAL | authentication/IP limiter present; no general per-client API quota |
| CORS | IMPLEMENTED | explicit allowlist in security config |
| API contract document | IMPLEMENTED | custom OpenAPI 3.0.3 at `/api/v1/meta/openapi.json`; `OpenApiServiceTest` asserts real endpoints + permissions + DTO shapes |
| Interactive docs (Swagger UI) | MISSING | no UI, JSON only |
| Over-fetching prevention | PARTIAL | list DTOs are lean; some detail endpoints return full nested graphs |
| HTTP semantics | PARTIAL | 204 used in some places where 400 was expected by a test (see Testing report, test-side defect); `DELETE` used for case-parcel removal |
| Batch/bulk endpoints | MISSING | one resource per call |
| Webhooks/event feed | MISSING | no outbound event API |
| API gateway / WAF / mTLS | MISSING | not present |

## 9. API security findings

| Finding | Severity | Detail |
|---|---|---|
| `AuthController` unauthenticated by design | INFO | `login`, `refresh`, `logout` public; `/me` requires a token |
| JWT HS256 with shared secret | MEDIUM | acceptable for single deployment; secret must be ≥256-bit and rotated (env-supplied) |
| No token revocation list for access tokens | MEDIUM | access token stays valid until expiry after logout; refresh-token family is ended |
| Password-reset code is 192-bit, hashed, single-use, 60-min | IMPLEMENTED | `PasswordService` |
| Login lockout 5/15 min, generic auth error messages | IMPLEMENTED | `AuthService`; no user-enumeration difference |
| BCrypt cost 12 | IMPLEMENTED | `PasswordEncoder` bean |
| Rate limiting in-memory per node | MEDIUM | not cluster-wide |
| `GET /openapi.json` authenticated | INFO | accessible to authenticated users; controls exposure |
| Delivery admin endpoints | IMPLEMENTED | guarded by `SETTINGS_MANAGE` |
| No request-size limit beyond uploads | MEDIUM | JSON body size not explicitly capped |

## 10. API verdict

**IMPLEMENTED** for surface, consistency, validation and authorisation; **PARTIAL** for operational maturity (no idempotency, no general quota, no API gateway, no Swagger UI, access-token revocation gap).

---

## 11. Consolidated DB/API findings

| ID | Finding | Area | Severity | Priority |
|---|---|---|---|---|
| DB-1 | Parcel area not reconciled with PostGIS geometry | DB | HIGH | P1 |
| DB-2 | No RLS/tenant isolation | DB | HIGH | P2 |
| DB-3 | No encryption at rest for PII/files | DB | HIGH | P1 |
| DB-4 | No partitioning/retention for history tables | DB | MEDIUM | P3 |
| DB-5 | Contacts table unused by API/UI | DB | MEDIUM | P1 |
| DB-6 | No backup/PITR runbook | DB | MEDIUM | P2 |
| API-1 | No idempotency keys for money/workflow POSTs | API | MEDIUM | P1 |
| API-2 | No general API quota | API | MEDIUM | P3 |
| API-3 | Access token not revocable before expiry | API | MEDIUM | P2 |
| API-4 | No Swagger UI | API | LOW | P3 |
| API-5 | No bulk/batch endpoints | API | LOW | P3 |
