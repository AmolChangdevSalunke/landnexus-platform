# Administration Module - Slice 1 (Master Data)

Status: implemented and verified in slice 1 (88 tests, smoke test 13/13). Protected by permissions since slice 2a.

## Scope of this slice
Ministries, Departments, States, Divisions, Districts, Talukas, Villages.

## Not in this slice (next slices)
Geographic access control, login history, audit events (see `SECURITY_AND_AUTH.md` for what slice 2a added: users, roles, permissions, JWT login).
**All endpoints below now require a valid access token and the permission shown in `SECURITY_AND_AUTH.md`.**

## Package layout (`com.landnexus.administration`)
| Package | Contents |
|---|---|
| `api` | REST controllers (HTTP only) |
| `api.dto` | Request / Response records (entities are never returned) |
| `application` | Services: business rules, transactions |
| `domain` | JPA entities, enums |
| `infrastructure` | Spring Data repositories |

Shared code: `com.landnexus.shared` (exceptions, `ApiError`, pagination, text normalisation).

## Hierarchy
```
Ministry -> Department (level: CENTRAL | STATE | DIVISION | DISTRICT)
State -> Division -> District (division optional) -> Taluka -> Village
```

## Endpoints (base `/api/v1/administration`)
Each resource (`ministries`, `departments`, `states`, `divisions`, `districts`, `talukas`, `villages`) has:

| Method | Path | Result |
|---|---|---|
| GET | `/{resource}?page=0&size=20[&parentId]` | paged list, sorted by name (size capped at 100) |
| GET | `/{resource}/{id}` | one record, 404 if unknown |
| POST | `/{resource}` | 201 created, 400 invalid, 404 unknown parent, 409 duplicate code |
| PUT | `/{resource}/{id}` | full update |
| POST | `/{resource}/{id}/deactivate` | status INACTIVE (no hard delete) |
| POST | `/{resource}/{id}/activate` | status ACTIVE |

List filter parameters: departments `ministryId`, divisions `stateId`, districts `stateId`, talukas `districtId`, villages `talukaId`.

## Rules
- `code` is trimmed and stored upper-case; unique globally (ministry, department, state) or within its parent (division, district, taluka, village).
- A district's division must belong to the same state (400 otherwise).
- IDs are UUIDs (no guessable sequential ids on government data).
- Timestamps are `TIMESTAMPTZ` (UTC instants). `created_by` / `updated_by` columns exist but stay empty until authentication is added.
- No hard delete: records are deactivated.

## Error format
```json
{ "timestamp": "...", "status": 409, "error": "Conflict", "message": "State code already exists: TS1", "path": "/api/v1/administration/states", "fieldErrors": [] }
```

## Database
Flyway `V2__administration_master_data.sql` (V1 enables PostGIS). Never edit an applied migration; add `V3__...` for changes.

## Tests
- Service unit tests (Mockito): normalisation, duplicate, unknown parent, not found, deactivate, district/division rule.
- Controller tests (MockMvc standalone): 201, 400 field errors, 400 missing parent, 409, 404, malformed UUID, page shape.
- Shared: `TextNormalizerTest`, `PageParamsTest`.
- Not yet covered: repository tests against a real PostgreSQL (planned with Testcontainers or a dedicated test database) and authorization tests (security slice).
