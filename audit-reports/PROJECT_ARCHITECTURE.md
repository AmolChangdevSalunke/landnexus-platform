# 1. Project Architecture Audit — LandNexus / NLAMS

**Audit date:** 14 November 2026
**Audit type:** read-only, static inspection + executed build/test verification
**Repository:** `D:\landnexus-platform`
**Audited commit:** `94875ea` plus an uncommitted working tree (`AssignmentDtos.java`, `application.properties`, untracked demo docs)
**Verification executed during this audit:** full backend `mvnw test` (542 tests, 519 pass / 14 fail / 3 error), full frontend `npm run test` (45 files, 233 tests, all pass), frontend `npm run build` (pass, 24.22 s)

---

## 1. Stack

| Layer | Technology | Evidence |
|---|---|---|
| Language / runtime | Java 21 | `pom.xml` `<java.version>21</java.version>`; test log `Java 21.0.12.1` |
| Backend framework | Spring Boot 4.1.2 | `landnexus-backend/pom.xml` parent `spring-boot-starter-parent` 4.1.2 |
| Security | Spring Security, stateless JWT HS256, BCrypt cost 12 | `shared/security/*`, `administration/application/AuthService.java` |
| Persistence | Spring Data JPA / Hibernate, PostgreSQL 18.6 | 52 JPA repository interfaces (startup log), `application.properties` |
| Spatial | PostGIS (`geometry(MultiPolygon,4326)`, GiST indexes) | `V1__enable_postgis.sql`, `V12__gis_geometry.sql` |
| Migrations | Flyway, 19 versioned migrations | `landnexus-backend/src/main/resources/db/migration/V1..V19` |
| Frontend | React 18.3 + TypeScript 5.6 + Vite | `LandNexus-frontend/package.json` |
| Frontend charts | Recharts 2.15 | `package.json`, `TrendChart` chunk (384.86 kB) |
| Frontend tests | Vitest 4.1 + Testing Library | `package.json`, `src/**/*.test.tsx` |
| Build tooling | Maven Wrapper (`mvnw.cmd`), npm/Vite | repo root, `LandNexus-frontend` |
| Observability | Spring Boot Actuator, `health,info` exposed | `application.properties` |

No containerisation, no CI pipeline, no infrastructure-as-code:

| Expected artefact | Present? | Evidence |
|---|---|---|
| `Dockerfile` / `docker-compose.yml` | No | recursive search found none |
| `.github/workflows/*` (or other CI) | No | `.github` directory absent |
| IaC (Terraform/K8s manifests) | No | not present |

---

## 2. Repository layout

```
D:\landnexus-platform
├── landnexus-backend/          Spring Boot service (326 Java files, 33 controllers, 205 endpoints)
│   ├── src/main/java/com/landnexus/
│   │   ├── administration/     users, roles, permissions, auth, master data, audit, geo scope
│   │   ├── projects/           proposals, proposal workflow/routing/assignments, projects
│   │   ├── landrecords/        parcels, landowners, ownership, mutations, revenue records, documents
│   │   ├── acquisition/        cases, case parcels, surveys, notices, objections, awards, possession
│   │   ├── compensation/       rates, rule sets, valuations, payments, R&R
│   │   ├── gis/                boundaries, alignments, conflict analysis, imagery proxy
│   │   ├── reporting/          dashboards, NLAMS monitoring, reports, SLA, forecast, settings
│   │   └── shared/             security, audit, notification, workflow, validation, openapi, exception
│   ├── src/main/resources/db/migration/   19 Flyway migrations
│   └── src/test/java/         84 test classes (83 executed)
├── LandNexus-frontend/         React SPA (47 pages, 59 routes, 15 API modules, 45 test files)
│   └── src/
│       ├── app/                router, navigation, breadcrumbs, roadmapModules, permission gates
│       ├── api/                one typed module per backend area
│       ├── features/           acquisition, admin, auth, compensation, gis, landRecords,
│       │                       monitoring, myWork, notifications, projects, proposals, roadmap, shared
│       ├── components/         UI primitives, layout, permission gates
│       └── legacy-prototype/   excluded from this audit
├── docs/                       setup, status, module notes, older traceability snapshot
└── scripts/                    PowerShell demo/seed helpers
```

---

## 3. Backend layering

Each business package follows the same vertical-slice layout:

| Layer | Package | Responsibility |
|---|---|---|
| API | `<module>/api` | `@RestController`, `@PreAuthorize`, DTOs in `<module>/api/dto` |
| Application | `<module>/application` | services, workflow, access checks, domain calculations |
| Domain | `<module>/domain` | JPA entities and enums |
| Infrastructure | `<module>/infrastructure` | Spring Data repositories, JDBC report queries, adapters |

Shared cross-cutting packages:

| Shared package | Contents |
|---|---|
| `shared/security` | JWT filter/decoder, security config, CORS, rate limiting, principal mapping |
| `shared/audit` | `AuditService` (writes inside caller transaction) |
| `shared/notification` | in-app notifications, transactional outbox, email/SMS adapters, dispatcher |
| `shared/workflow` | `WorkflowDefinition`/`Transition` deterministic state machines |
| `shared/validation` | `PasswordPolicy`, `TextNormalizer`, validators |
| `shared/openapi` | custom OpenAPI 3.0.3 document generator (`/openapi.json`) |
| `shared/exception` | `ApiExceptionHandler` (`@RestControllerAdvice`), typed exceptions |
| `shared/response` | `ApiError`, `PageResponse` |

Counts: 326 Java files, 47 `@Entity` classes, 52 JPA repositories, 33 controllers, 205 endpoint mappings, 150 `@Transactional` annotations, 70 `@Valid` usages, 124 bean-validation constraint annotations, 19 migrations.

Observations:

- Controllers are thin; business rules, ownership and scope checks sit in services.
- Every controller except `AuthController` carries `@PreAuthorize` (35 files matched). `AuthController` is intentionally public for `login`/`refresh`/`logout`, and `/me` is authenticated.
- The workflow engine (`WorkflowDefinition`) rejects unknown transitions, enforces required authority and required reason at construction time; unit-tested in `WorkflowDefinitionTest` (6 tests).
- Report queries bypass JPA via `JdbcTemplate` (`reporting/infrastructure/*`), reading from SQL views (`rpt_*`).
- **Exception:** `ProposalService` is class-level `@Transactional(readOnly = true)` and two public write entry points (`transition`, `reject`) are not re-annotated, which breaks proposal workflow at runtime — see `BUGS_AND_TECHNICAL_ISSUES.md` P0-1.

---

## 4. Frontend architecture

| Concern | Implementation | Evidence |
|---|---|---|
| Routing | `react-router-dom`, 59 `<Route>` entries | `src/app/router.tsx` |
| Authorisation | `RequirePermission` wrapper, 85 usages | `src/app/router.tsx`, `src/components/auth/*` |
| Navigation | permission-filtered sidebar; implemented vs roadmap split | `src/app/navigation.ts`, `src/app/roadmapModules.ts` |
| Data access | 15 typed API modules over a single `apiClient` | `src/api/*.ts` |
| Server state | custom `useApiQuery` / `usePagination` hooks, visibility-aware polling | `src/hooks/*` |
| Pages | 47 feature pages, zero `PlaceholderPage` routes | `src/features/**/*Page.tsx` |
| Honesty control | roadmap modules rendered as "Planned", never as working links | `roadmapModules.ts`, `RoadmapPage` |
| Maps | custom SVG `ScopeMap` (lazy-loaded, 466 kB chunk), no external map SDK | `src/features/myWork/ScopeMap.tsx` |
| Styling | design-system components (`components/ui/*`) | repo |

The frontend does not contain hard-coded demo records in feature pages; lists are loaded from the API. The only "planned" surface is the explicit roadmap page.

Frontend build output: `dist/assets/index-CGN30cyA.js` = 944.34 kB (gzip 245.32 kB), plus per-state map chunks up to 460 kB. Vite emits a chunk-size warning only; build succeeds.

---

## 5. Runtime topology

```
Browser (React SPA)
   │  JSON over HTTPS, Bearer JWT
   ▼
Spring Boot API  ── JWT filter → @PreAuthorize → service → repository
   │                                   │
   │                                   ├── Flyway-managed PostgreSQL 18 + PostGIS
   │                                   ├── local file storage (outside web root, .bin names)
   │                                   └── notification outbox → dispatcher → email/SMS adapter
   ▼
Actuator /health, /info
```

- Stateless API: no server session; refresh tokens are persisted and rotated.
- File uploads validated by magic bytes (`FileValidator`: PDF/JPEG/PNG, ≤10 MB) and stored under random `.bin` names outside the web root (`LocalFileStorage`).
- Background work: `SlaScheduler` is opt-in via `LANDNEXUS_SLA_SCHEDULER`; notification dispatch is pull-based via a bounded dispatcher.

---

## 6. Architecture verdict

| Area | Verdict | Reason |
|---|---|---|
| Module boundaries | IMPLEMENTED | 8 coherent vertical slices, no cyclic package dependencies observed |
| Layering discipline | IMPLEMENTED | thin controllers, service-layer rules, repository isolation |
| Transaction design | PARTIAL | sound overall (150 annotations, explicit read-only classes) but `ProposalService` P0 defect |
| Stateless security | IMPLEMENTED | JWT + refresh rotation + lockout + rate limit |
| Database evolution | IMPLEMENTED | 19 ordered Flyway migrations, all applied cleanly on a disposable DB |
| Frontend structure | IMPLEMENTED | typed API layer, permission-gated routes, no placeholder pages |
| Operability | PARTIAL | actuator health only; no metrics/tracing, no CI, no containers |
| Documentation | PARTIAL | strong docs for setup/status; no formal 249-item NLAMS requirements spec |

**Overall architecture status: IMPLEMENTED (with one P0 transactional defect and no delivery/CI layer).**
