# LandNexus / NLAMS — API Documentation

**Last updated:** 15 November 2026  
**Base path:** `/api/v1`  
**Authentication:** `Authorization: Bearer <access token>` unless an endpoint is explicitly public.

The running application is the source of truth. It exposes a generated OpenAPI 3.0 document at:

```
GET /api/v1/meta/openapi.json
```

The document is built from the live controller mappings and their permission annotations, so it stays aligned with the code. Use `scripts/export-openapi.ps1` to save it for a viewer or Postman.

---

## 1. Conventions

- JSON request and response bodies; file upload endpoints use `multipart/form-data`.
- IDs are UUIDs unless a business code is documented (for example `projectCode`).
- Errors use the shared error payload: `timestamp`, `status`, `error`, `message`, `path`, `fieldErrors`.
- Authorization is enforced by Spring Security method annotations **and** service-level ownership/geographic-scope checks. A UI permission check is not a security boundary.
- Lists that can grow use the shared `PageResponse` shape (`content`, `page`, `size`, `totalElements`, `totalPages`).
- Private files are never served from an unauthenticated URL. The client fetches them with the bearer token and renders/saves the returned blob.
- State-changing actions return the updated resource and append audit/history rows where applicable.

---

## 2. Authentication and account

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | public | Issue access and refresh tokens; records login history. |
| `POST` | `/auth/refresh` | public (valid refresh token) | Rotate the refresh token and issue a new access token. |
| `POST` | `/auth/logout` | authenticated | Revoke the presented refresh token. |
| `GET` | `/auth/me` | authenticated | Current user, roles, permissions and scopes. |
| `POST` | `/auth/change-password` | authenticated | Change own password. |
| `POST` | `/auth/reset-password` | public | Consume a reset code and set a new password. |
| `POST` | `/administration/users/{id}/password-reset` | `USER_WRITE` | Issue a one-time reset code for a user. The code is shown only to the administrator. |
| `PUT` | `/administration/users/{id}` | `USER_WRITE` | Update a user's email and full name; duplicate emails and protected super-admin targets are rejected and the change is audited. |

---

## 3. Proposals and routing

Base path: `/projects/proposals`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/` | `PROPOSAL_CREATE` | Create a draft. Number is allocated on submission. |
| `GET` | `/` | `PROPOSAL_READ` / `PROPOSAL_READ_OWN` | List visible proposals (paged). |
| `GET` | `/{id}` | `PROPOSAL_READ` / `PROPOSAL_READ_OWN` | Proposal details, including `acquisitionCaseNumber` when approved. |
| `PUT` | `/{id}` | `PROPOSAL_CREATE` | Edit an editable draft owned by the caller. |
| `GET` | `/{id}/history` | read permission | Append-only status history. |
| `GET` | `/{id}/versions` | read permission | Frozen proposal versions. |
| `GET` | `/{id}/assignments` | read permission | Routing/assignment history. |
| `GET` | `/my-tasks` | authenticated | Open assignments for the caller. |
| `GET` | `/{id}/validation` | read permission | DGOR-style validation items (`PASS` / `WARN` / `FAIL`). |
| `POST` | `/{id}/submit` | `PROPOSAL_CREATE` | Validate, allocate number, freeze v1, route to scrutiny. |
| `POST` | `/{id}/resubmit` | `PROPOSAL_CREATE` | Resubmit after clarification; creates a new version. |
| `POST` | `/{id}/reopen` | owner | Reopen a rejected proposal to draft with a reason. |
| `POST` | `/{id}/start-scrutiny` | `PROPOSAL_SCRUTINIZE` | Claim/start the scrutiny stage. |
| `POST` | `/{id}/clarification` | `PROPOSAL_SCRUTINIZE` | Request clarification; reason required. |
| `POST` | `/{id}/recommend` | `PROPOSAL_SCRUTINIZE` | Recommend for decision; routes by rule. |
| `POST` | `/{id}/approve` | `PROPOSAL_DECIDE` | Maker-checker approval; creates project and one acquisition case. |
| `POST` | `/{id}/reject` | `PROPOSAL_DECIDE` | Reject; reason required. |
| `GET` | `/{id}/reassignment-candidates?stage=SCRUTINY\|DECISION` | `PROPOSAL_ASSIGNMENT_MANAGE` | List enabled officers eligible for the proposal's district and stage. |
| `POST` | `/{id}/assignments/{assignmentId}/reassign` | `PROPOSAL_ASSIGNMENT_MANAGE` | Reassign an open task; request includes `assignedUserId` and a required reason. The backend validates scope/state, audits and notifies. |

### Routing-rule administration

Base path: `/projects/routing-rules`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/` | `ROUTING_RULE_READ` | List routing rules in application order. |
| `POST` | `/` | `ROUTING_RULE_MANAGE` | Create a validated rule. |
| `PUT` | `/{id}` | `ROUTING_RULE_MANAGE` | Update a rule. |
| `POST` | `/{id}/activate` | `ROUTING_RULE_MANAGE` | Activate a rule. |
| `POST` | `/{id}/deactivate` | `ROUTING_RULE_MANAGE` | Deactivate a rule; the final active rule cannot be disabled. |

Mutations are audited. Rules configure proposal/project type, area thresholds and decision level; named officer targets are not supported. Authorized manual reassignment is available through the proposal routes above.

---

## 4. Projects

Base path: `/projects`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/` | `PROPOSAL_READ` / `PROPOSAL_READ_OWN` | Paged project register within the caller's scope. |
| `GET` | `/{id}` | read permission | Project details. |
| `PUT` | `/{id}` | `PROJECT_MANAGE` | Correct editable details. Code, proposal, owner and approval fields are immutable. Closed projects are read-only. |
| `POST` | `/{id}/close` | `PROJECT_MANAGE` | Close a project. Reason is optional; the action is audited. |
| `POST` | `/{id}/reopen` | `PROJECT_MANAGE` | Reopen a closed project. The action is audited. |

`PROJECT_MANAGE` is granted by `V20` to `SUPER_ADMIN`, `CENTRAL_ADMIN`, `STATE_ADMIN`, `DIVISION_ADMIN` and `DISTRICT_ADMIN`, and is still bounded by the existing project visibility/geographic scope.

---

## 5. Land records and documents

### Parcels, owners, mutations and revenue records

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` / `POST` | `/land-records/parcels` | `LAND_RECORD_READ` / `LAND_RECORD_WRITE` | List or create parcels. |
| `GET` / `PUT` | `/land-records/parcels/{id}` | read/write | Read or update a parcel. |
| `POST` | `/land-records/parcels/{id}/activate` / `deactivate` | `LAND_RECORD_WRITE` | Change parcel status. |
| `GET` / `POST` | `/land-records/parcels/{parcelId}/ownerships` | read/write | List or add ownership shares (total capped at 100%). |
| `POST` | `/land-records/parcels/{parcelId}/ownerships/{ownershipId}/end` | write | End an ownership. |
| `GET` / `POST` | `/land-records/parcels/{parcelId}/mutations` | read/write | List or record mutations. |
| `GET` / `POST` | `/land-records/parcels/{parcelId}/revenue-records` | read/write | List or record 7/12/8A records. |
| `GET` / `POST` | `/land-records/landowners` | `LANDOWNER_READ` / `LANDOWNER_WRITE` | List or create landowners. Personal data is masked unless permitted and audited. |

### Documents

Base path: `/land-records`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/parcels/{parcelId}/documents` | `DOCUMENT_READ` | List document metadata and versions. |
| `POST` | `/parcels/{parcelId}/documents` | `DOCUMENT_UPLOAD` | Upload PDF/JPEG/PNG with category and title. |
| `GET` | `/documents/{id}` | `DOCUMENT_READ` | Document metadata and version history. |
| `POST` | `/documents/{id}/versions` | `DOCUMENT_UPLOAD` | Add a version; verification returns to `PENDING`. |
| `GET` | `/documents/{id}/versions/{versionNo}/download` | `DOCUMENT_READ` | Audited attachment download. |
| `GET` | `/documents/{id}/versions/{versionNo}/preview` | `DOCUMENT_READ` | Audited **inline** preview for PDF/JPEG/PNG only. |
| `POST` | `/documents/{id}/verify` | `DOCUMENT_VERIFY` | Verify the current version (uploader cannot verify their own). |
| `POST` | `/documents/{id}/reject` | `DOCUMENT_VERIFY` | Reject with required remarks. |

File type is decided from the file's magic bytes, not its extension. Downloads and previews set `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. The preview endpoint refuses any other stored type rather than serving it inline.

---

## 6. Acquisition, compensation and GIS

| Area | Base path | Summary |
|---|---|---|
| Acquisition | `/acquisition` | Cases, case villages, case parcels, assignments, surveys, verification, notices, objections, awards, possession and closure. |
| Compensation | `/compensation` | Rate cards, rule sets, assets, valuations, SIMULATED payments, R&R cases/entitlements. |
| GIS | `/gis` | Parcel boundaries, project alignments, conflicts and map data. Imagery endpoints report configuration/status only. |

Key acquisition endpoints are listed by the generated OpenAPI document; lifecycle actions are guarded by acquisition permissions and case/geographic scope.
Confirmed simulated payments can be downloaded from `GET /compensation/payments/{id}/receipt` (`PAYMENT_READ`). The text receipt is marked SIMULATED and is served with `Cache-Control: no-store`; it does not contain bank details.

The interactive frontend map uses the existing scoped GeoJSON APIs such as `GET /gis/projects/{projectId}/map` and `GET /gis/villages/{villageId}/parcels`. With `GIS_WRITE`, supported GeoJSON polygon boundaries and line alignments are persisted through:

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `PUT` | `/gis/parcels/{parcelId}/boundary?sourceNote=...` | `GIS_WRITE` | Validate and persist a parcel boundary geometry in PostGIS. |
| `GET` | `/gis/parcels/{parcelId}/boundary` | `GIS_READ` | Retrieve the boundary as GeoJSON. |
| `GET` | `/gis/parcels/{parcelId}/boundary/history` | `GIS_READ` | List boundary versions. |
| `PUT` | `/gis/projects/{projectId}/alignment?corridorWidthM=...&sourceNote=...` | `GIS_WRITE` | Validate and persist a project alignment in PostGIS. |
| `GET` | `/gis/projects/{projectId}/conflicts` | `GIS_READ` | Return parcel conflict/affected-area analysis. |
| `GET` | `/gis/projects/{projectId}/map` | `GIS_READ` | Return map features including project alignment/corridor and affected parcels. |

OpenStreetMap provides the fallback basemap. These APIs do not imply a verified Bhuvan connection or authoritative boundary coverage; GIS operations remain subject to backend geographic scope checks.

---

## 7. Administration, monitoring and notifications

| Area | Base path | Summary |
|---|---|---|
| Master data | `/administration/{states,divisions,districts,talukas,villages,departments,ministries}` | Paginated read, create, update, activate/deactivate. |
| Users | `/administration/users` | List/create users, replace roles, enable/disable, issue reset codes. |
| Geographic scope | `/administration/users/{id}/scopes`, `/administration/my-districts` | Read/replace user scopes. |
| Roles | `/administration/roles`, `/administration/permissions` | Read role and permission catalogues. |
| Role permissions | `PUT /administration/roles/{id}/permissions` | `ROLE_MANAGE`; replace the role's permission set with backend validation and audit. |
| Audit | `/administration/audit-events`, `/administration/login-history` | `AUDIT_READ`-guarded, paged. |
| Notifications | `/notifications` | Own notifications, unread count, mark read. |
| Delivery console | `/notifications/deliveries` | `SETTINGS_MANAGE` list/retry for external outbox. |
| Monitoring | `/monitoring/dashboard`, `/monitoring/nlams`, `/monitoring/reports`, `/monitoring/forecast`, `/monitoring/sla` | Scoped dashboards, NLAMS progress, reports/CSV, SLA rules/scan/escalations. |

MIS report run and CSV export endpoints accept optional `stateId`, `districtId`, `talukaId`, `projectId`, `status`, `fromDate` and `toDate` filters. Report rows remain paged (up to 200 rows per request); exports retain the 10,000-row cap and audit record. V23 adds internal report-view dimensions for taluka and project/date filtering without changing existing report columns.

`GET /monitoring/dashboard` accepts geographic, project, inclusive date and proposal/project/acquisition status filters. Filtered dashboard trends, district comparisons, task/escalation metrics and channel aggregates use the same request scope. V26 adds an explicit simulated `paymentChannel` field to generated compensation payments (`UNCLASSIFIED` by default; `PFMS_SIMULATED`, `DBT_SIMULATED` and `OTHER_SIMULATED` are labels only). It does not connect to PFMS/DBT or transfer funds. Apply V26 before using the field; the latest migration and PostgreSQL aggregate verification are still pending.

---

## 8. Endpoint changes delivered in Phase 1

- Added `PUT /projects/{id}`, `POST /projects/{id}/close`, `POST /projects/{id}/reopen`.
- Added `GET /land-records/documents/{id}/versions/{versionNo}/preview`.
- Fixed `POST /projects/proposals/{id}/submit` to commit and allocate its number.
- Fixed reassignment during `start-scrutiny` so it no longer violates the open-stage unique index.
- Wired the forgot-password screen to the existing public `POST /auth/reset-password`.
- Added guarded routing-rule list/create/update/activate/deactivate endpoints.
- Added guarded role permission catalogue/update endpoints.
- Added audited `PUT /administration/users/{id}` profile editing.
- Added date, project and taluka dimensions to the existing paged MIS run/export endpoints.
- Added protected simulated payment receipt download.

No existing endpoint was removed or renamed.
