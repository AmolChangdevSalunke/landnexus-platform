# LandNexus / NLAMS — Implementation Roadmap

**Last updated:** 15 November 2026  
**Status source:** this roadmap, `docs/PROJECT_STATUS.md`, and the phase completion reports.  
**Rule:** phases are delivered sequentially. A later phase is not started until the previous phase has a completion report and verification evidence.

---

## 1. Guiding constraints

- Extend the existing modular monolith; do not rebuild working modules.
- Backend remains Java 21 / Spring Boot 4, PostgreSQL + PostGIS, Flyway.
- Existing migrations are immutable. New schema changes start at `V20`.
- Authorization is enforced in the backend, not only hidden in the UI.
- API boundaries use DTOs, not JPA entities.
- Destructive database commands, commits and pushes require explicit approval.
- Tests must report actual results; valid tests are never weakened to make a run green.

---

## 2. Phase 1 — Stabilise the critical path (complete)

**Goal:** make the proposal → project path, document handling and authentication demonstrable without known blocking defects.

| Work item | Status | Evidence |
|---|---|---|
| Proposal submission transaction failure (P0) | Done | `ProposalService.submit` now runs in a transaction; `proposal_number` is allocated and the record commits. |
| Scrutiny start conflict on reassignment | Done | `ProposalRoutingService.startScrutiny` flushes the closing assignment before inserting the replacement. |
| Proposal workflow integration tests | Done | Cleanup order fixed (`proposal_assignments` before `proposals`); stale `CurrentActor` fixtures and routing expectations corrected. |
| Project edit / close / reopen | Done | `V20__project_management.sql`, `PUT /projects/{id}`, `POST /projects/{id}/close`, `POST /projects/{id}/reopen`, `PROJECT_MANAGE`, frontend edit page and details actions. |
| Forgot-password flow | Done | Existing public reset endpoint wired to the reset form; no reset codes are exposed by the UI. |
| Document preview | Done | Audited inline endpoint for PDF/JPEG/PNG plus an authenticated blob preview dialog. |
| Full regression verification | Done | See `docs/TESTING_AND_VERIFICATION.md` and `docs/PHASE_1_COMPLETION_REPORT.md`. |
| Role/permission administration (BUG-008) | Deferred to Phase 2 | Read-only matrix remains; admin capability belongs with the Phase 2 administration work. |
| Routing-rule administration (BUG-009) | Deferred to Phase 2 | Seeded rules remain; no API or screen yet. |

**Exit criteria:** no open P0/P1 defect on the proposal → project path; the full backend and frontend suites pass; Phase 1 report and verification record are written.

---

## 3. Phase 2 — Complete the administrative and land/GIS capability

**Goal:** make land records, acquisition lifecycle, administration, notifications/SLA and reports operable end to end.

Planned order:

1. **Role and permission administration (BUG-008)** — guarded role-permission matrix editing, audit, no self-lockout.
2. **Routing-rule administration and manual assignment (BUG-009)** — CRUD with validation, activation/retirement, audited manual reassignment.
3. **Land and GIS workflows** — close remaining parcel/ownership/geometry usability gaps and honest imagery status.
4. **Acquisition lifecycle** — notices, objections, awards, possession and closure checks.
5. **Administration** — user/scope consistency, master-data validation, notifications and SLA settings.
6. **Reporting** — filterable reports, CSV consistency and totals that match the source data.

**Exit criteria:** every Phase 2 screen is backed by a protected endpoint, negative authorization tests exist, and `docs/PHASE_2_COMPLETION_REPORT.md` records actual results.

---

## 4. Phase 3 — Integrations, citizen services and hardening

**Goal:** demonstrate the external and public-service boundaries safely, without pretending simulated services are real.

Planned order:

1. **Simulated government integrations** — BhuNaksha, 7/12/8A/Ferfar, PFMS/DBT and Bhuvan adapters with explicit `SIMULATED` labelling and failure handling.
2. **Citizen portal** — application status and grievance submission behind a separate, minimal identity path.
3. **Grievances** — intake, assignment, SLA, response and closure.
4. **Hardening** — document malware scanning/encryption decision, rate limits, token invalidation, dependency and configuration review.
5. **Operational readiness** — backup/restore, deployment target, smoke tests and demo runbook refresh.

**Exit criteria:** simulated integrations are visibly labelled and cannot be mistaken for live services; `docs/PHASE_3_COMPLETION_REPORT.md` records actual results and residual risks.

---

## 5. Cross-cutting risks

| Risk | Mitigation |
|---|---|
| PostgreSQL aborts a transaction after a constraint error | Never query after an aborted statement in the same transaction; roll back and recover in a fresh transaction. |
| Integration tests touch a developer database | All DB-backed tests use `LANDNEXUS_TEST_DB_*` and fail fast on `landnexus_dev`. |
| UI permission checks mistaken for security | Every protected operation also has a backend `@PreAuthorize` and scope check. |
| Seeded configuration treated as administration | Document read-only configuration explicitly until the Phase 2 admin screens exist. |
| Simulated integrations presented as live | Every simulated response and screen is labelled `SIMULATED`; status is tracked in `docs/GOVERNMENT_INTEGRATION_STATUS.md`. |
