# 8. Final Gap Analysis — LandNexus / NLAMS

**Audit date:** 14 November 2026
**Audited revision:** `94875ea` + uncommitted working tree
**Reports in this set:** architecture · modules · traceability matrix · integrations · database & API · bugs · testing · this summary

---

## 1. Headline numbers

| Metric | Value |
|---|---|
| Requirements baseline used | **127** repository-derived requirements (`M1-01`…`M8-13`) |
| Formal 249-item NLAMS specification found | **No** — traceability to it is `UNVERIFIED` |
| **IMPLEMENTED** | **89 (70.1 %)** |
| **PARTIAL** | **19 (15.0 %)** |
| **MOCK** | **2 (1.6 %)** |
| **MISSING** | **17 (13.4 %)** |
| Delivered to some degree (I + P + MOCK) | 110 (86.6 %) |
| Weighted delivery (I = 1, P/MOCK = 0.5) | 99.5 / 127 (**78.3 %**) |

Rounding makes the four percentages sum to 100.1 %.

**Limitation statement (must travel with these numbers):** the brief’s 249 numbered requirements do not exist in the repository or the supplied material. A previous audit (`docs/REQUIREMENTS_TRACEABILITY.md`, 86 rows, 2026-11-06) recorded the same absence. The 127 rows here are a faithful, evidence-backed baseline of what the product sets out to do in its own documentation and code, organised into the brief’s 8 modules. Whether they cover all 249 customer items — and how many customer items are not represented at all — is **UNVERIFIED**.

---

## 2. Module-wise completion

| Module | Rows | IMPLEMENTED | PARTIAL | MOCK | MISSING | Completion (I / rows) | Weighted |
|---|---|---|---|---|---|---|---|
| M1 Administration, identity & access | 20 | 16 | 2 | 0 | 2 | **80.0 %** | 85.0 % |
| M2 Proposals & government projects | 18 | 10 | 6 | 0 | 2 | **55.6 %** | 72.2 % |
| M3 Land records & documents | 16 | 11 | 1 | 0 | 4 | **68.8 %** | 71.9 % |
| M4 Land acquisition lifecycle | 18 | 15 | 3 | 0 | 0 | **83.3 %** | 91.7 % |
| M5 Field surveys | 10 | 7 | 1 | 0 | 2 | **70.0 %** | 75.0 % |
| M6 Valuation & compensation | 18 | 15 | 0 | 1 | 2 | **83.3 %** | 86.1 % |
| M7 GIS, monitoring & MIS | 14 | 11 | 2 | 0 | 1 | **78.6 %** | 85.7 % |
| M8 Integrations & notifications | 13 | 4 | 4 | 1 | 4 | **30.8 %** | 50.0 % |
| **Total** | **127** | **89** | **19** | **2** | **17** | **70.1 %** | **78.3 %** |

**Ranking by real completeness:** M4 acquisition (83 %) ≈ M6 compensation (83 %) > M1 admin (80 %) > M7 GIS (79 %) > M5 surveys (70 %) > M3 land records (69 %) > **M2 proposals (56 %)** > **M8 integrations (31 %)**.

M2 ranks low not because it lacks code — it has the most code of any module — but because its entire execution path is broken (P0-1). M8 is low because government connectivity is simulated or absent by design.

---

## 3. Layer-wise completion

| Layer | Completion | Evidence | Main gaps |
|---|---|---|---|
| **Database** | **90 % schema / 55 % production hardening** | 64 tables, 6 business views, 19/19 migrations, 116 FKs, 543 CHECKs, 45 UNIQUEs, 170 indexes, 10 append-only triggers, 2 GiST indexes | no RLS/tenant isolation, no encryption at rest, no partitioning/retention, area reconciliation, unused `notification_contacts`, no backup/PITR |
| **Backend API** | **100 % module breadth / ~80 % functional readiness** | 33 controllers, 205 endpoints, all 8 modules, `@PreAuthorize` everywhere except auth, consistent `ApiError`, 70 `@Valid`, 124 constraints | P0-1 blocks 8 proposal endpoints; missing project edit/close, role writes, routing-rule admin, notification contacts, PDF/DSC, idempotency |
| **Frontend** | **~85 %** | 47 pages, 59 routes, 15 typed API modules, 85 permission gates, 0 placeholders, 233/233 tests, build pass | forgot-password, role admin, routing admin, notification preferences/console, project edit/close, manual SLA scan, 944 kB entry chunk |
| **Business logic** | **~80 %** | workflow state machines, compensation engine, conflict analyzer, 5-milestone monitoring, SLA/forecast, duplicate-safe creation | P0-1; statutory per-framework timelines; survey→geometry linkage |
| **External integrations** | **~15 %** | 1 mock (PFMS), 1 configurable-but-unconfigured (WMS/Bhuvan), 2 manual data-entry substitutes (7/12, 8A), partial notification adapters | no real government rail, no BhuNaksha/Ferfar, no beneficiary/bank model, no reconciliation |
| **Security** | **~75 %** | JWT+refresh rotation, BCrypt 12, lockout, rate limit, 13 roles/60 permissions, append-only audit, magic-byte uploads, masked contacts, simulation guard | no AV, no encryption at rest, no MFA/SSO, in-memory rate limit, access-token revocation gap, no RLS |
| **Delivery/operability** | **~25 %** | actuator health/info, Flyway, env-based config, OpenAPI JSON | no CI, no Docker, no metrics/tracing, no backup runbook, red backend suite |

---

## 4. Critical bugs (must fix before any demo claim)

| ID | Severity | Bug | Effect |
|---|---|---|---|
| **BUG-001** | **P0** | `ProposalService` class-level `@Transactional(readOnly = true)`; `transition` (L217) and `reject` (L226) not re-annotated; `self.applyNonApproveInTransaction` joins the read-only tx | **Every proposal state change returns 500** (`cannot execute nextval() in a read-only transaction`, 14×). Submit, scrutiny, clarification, recommend, approve, reject, reopen all fail. Approval additionally cannot run `SELECT … FOR UPDATE` in a read-only tx. |
| BUG-002 | P1 | `ProposalApprovalReliabilityIntegrationTest.setUp:88` creates `/departments` without `ministryId`/`level` | 6 tests fail at setup; approval reliability/concurrency unproven |
| BUG-003 | P1 | Integration cleanup deletes from `parcel_owners` / `affected_parcels` (renamed to `case_parcel_owners` / `case_parcels`) | `relation does not exist`; test data leaks between tests |
| BUG-004 | P1 | `PasswordIntegrationTest:125` expects rejection for `prefix + "Aa1"` although only the full username is banned | 1 false failure; product is correct |
| BUG-005 | P1 | Backend suite red (`BUILD FAILURE`, 17 non-passing) with no CI | no regression gate |
| BUG-006 | P1 | Forgot-password UI says “not available” while backend reset exists | user-facing dead end |
| BUG-007 | P1 | No project edit/close API | project lifecycle incomplete |
| BUG-008 | P1 | Roles/permissions read-only (`GET` only) | cannot administer RBAC at runtime |
| BUG-009 | P1 | Routing rules unusable (seeded, no admin API/UI) | workflow routing cannot be changed |
| BUG-010 | P1 | `notification_contacts` unreachable (no API/UI) | e-mail/SMS preferences cannot be set |
| BUG-011 | P1 | Parcel area not reconciled with PostGIS area | legal-area inconsistency risk |
| BUG-012 | P1 | No AV/encryption/retention for documents | unacceptable for real land documents |
| BUG-013 | P1 | No CI | quality cannot be enforced |

Full register: `BUGS_AND_TECHNICAL_ISSUES.md`.

---

## 5. Security issues

| Severity | Issue | Current mitigation | Needed |
|---|---|---|---|
| HIGH | Uploads not malware-scanned | magic-byte type + size + neutral `.bin` storage | AV engine (ClamAV/ICAP) |
| HIGH | No encryption at rest (files/PII) | none | storage encryption + column encryption |
| MEDIUM | Access token valid until expiry after logout | short TTL; refresh family ended | denylist/token version |
| MEDIUM | Rate limiting per node, in memory | login lockout + limiter | shared store/gateway quota |
| MEDIUM | No idempotency on payment/workflow POSTs | state machine + unique constraints | `Idempotency-Key` |
| MEDIUM | No DB row-level/tenant isolation | `GeoScopeService` | Postgres RLS |
| MEDIUM | No MFA/SSO for privileged roles | password + lockout | TOTP/OIDC |
| MEDIUM | No backup/PITR runbook | none | automated backups + restore drill |
| LOW | No egress allowlist for outbound adapters | validated HTTPS URL | host allowlist |
| LOW | No non-upload request-size cap | framework defaults | explicit limit |

**Verified strengths:** stateless JWT HS256, BCrypt cost 12, 5-attempt/15-min lockout, refresh rotation with reuse detection ending all sessions, per-endpoint `@PreAuthorize`, 85 UI permission gates, append-only audit/login/history triggers, random non-executable file names outside web root, contact masking, payment-mode guard, config fail-fast for imagery, secrets never logged.

---

## 6. Remaining work

### Must-have (blocks an honest “working product” claim)

1. Fix BUG-001 and prove the workflow end-to-end.
2. Make the backend suite green (BUG-002/003/004).
3. Wire the forgot-password page (BUG-006).
4. Project edit/close (BUG-007).
5. Role and routing-rule administration (BUG-008/009).
6. Commit the working tree and demo scripts so another machine reproduces the demo (BUG-021/022).
7. CI running backend + frontend tests (BUG-013).

### Should-have (production credibility)

8. Document AV + storage encryption + retention (BUG-012).
9. Parcel-area reconciliation between land records and GIS (BUG-011).
10. Notification contact UI + delivery console (BUG-010).
11. RLS or documented single-tenant boundary; access-token revocation; idempotency.
12. Server-side PDF for notices/awards (BUG-019) and report PDF/Excel.
13. Statutory per-framework timelines (M4-16).
14. Survey geometry → parcel boundary linkage (M5-07).
15. Bundle splitting to cut the 944 kB entry chunk (BUG-014).

### Could-have (roadmap, not hackathon)

16. BhuNaksha import, Ferfar/7-12/8A APIs, Bhuvan live configuration.
17. PFMS/DBT + beneficiary bank validation + reconciliation.
18. Mobile/offline surveys; equipment management; bulk imports.
19. MFA/SSO; citizen portal; BI layer; containers; observability stack.

---

## 7. Top 10 hackathon priorities (ordered)

| # | Priority | Why | Effort | Definition of done |
|---|---|---|---|---|
| 1 | **Fix BUG-001** (`ProposalService` transaction) | without it the flagship flow is dead; everything else is demo theatre | 2–4 h | `POST /submit` → 200 + proposal number; audit/history/notification rows written |
| 2 | **Green the 3 workflow integration tests** (BUG-002/003) | only guard against duplicate projects/cases and workflow regressions | 2–3 h | `mvnw test` green; concurrency test passes |
| 3 | **Fix BUG-004** | trivial, removes last false red | 10 min | 542/542 backend tests pass |
| 4 | **Wire Forgot Password UI** (BUG-006) | visible, user-facing, backend already exists | 1–2 h | request + reset code flow works from the login page |
| 5 | **Project close/edit** (BUG-007) | completes the project lifecycle shown in dashboards | 3–4 h | `PUT /projects/{id}`, `POST /projects/{id}/close` + UI |
| 6 | **Role & routing-rule admin** (BUG-008/009) | turns seeded RBAC/routing into a real admin capability | 1 day | CRUD APIs + screens guarded by `USER_WRITE` / `ROUTING_RULE_MANAGE` |
| 7 | **Notification preferences + delivery console** (BUG-010) | makes the outbox/contact tables actually usable in a demo | 1 day | contact/preferences screen; delivery list + retry screen |
| 8 | **CI pipeline** (BUG-013) | prevents re-breaking the demo | 1–2 h | GitHub Actions: Postgres service, backend tests, frontend tests+build |
| 9 | **Area reconciliation + conflict re-check** (BUG-011) | legally meaningful GIS/land-record consistency, strong judge story | 3–4 h | mismatch indicator surfaced; reconciliation endpoint/UI |
| 10 | **Demo hardening** (BUG-021/022): commit scripts, one-command seed/reset, label all simulations | avoids “works on my laptop” and false integration claims | 3–4 h | clean clone → one command → working demo; every mock labelled |

Runner-up: split the 944 kB entry chunk (route-level lazy loading) — visible performance win, ~2 h.

---

## 8. Honest positioning for a demo

**Defensible claims**

- “8 modules, 64 tables, 19 migrations, 205 REST endpoints, 47 screens, 233 passing frontend tests.”
- “Deterministic workflow state machines with role authority and mandatory reasons.”
- “Append-only audit, login history, document versions, case history, payment events, SLA escalations.”
- “Duplicate-safe project/case creation with a database unique constraint and recovery path.”
- “PostGIS-validated boundaries and a deterministic conflict analyzer.”
- “Five-milestone NLAMS monitoring, SLA scan/escalation, breach forecast, CSV reports.”
- “JWT with refresh rotation, lockout, permissions, geographic scoping.”
- “Every external system is isolated behind a seam and cannot masquerade as real.”

**Claims to avoid**

- “Fully implemented / production-ready.” → backend suite is red and the proposal workflow 500s.
- “PFMS/DBT integrated.” → `SIM-PFMS-` simulation only.
- “Bhuvan integrated.” → generic WMS proxy, disabled, unconfigured.
- “BhuNaksha / Ferfar integrated.” → absent; records are typed manually.
- “All 249 requirements covered.” → the specification is not in the repository; only a 127-row derived baseline was audited.
- “Documents are secure.” → no AV, no encryption at rest.

---

## 9. Final verdict

| Dimension | Grade | Rationale |
|---|---|---|
| Scope & architecture | **A−** | complete 8-module design, clean layering, real DB model |
| Implementation breadth | **B+** | 89/127 requirements fully implemented across every module |
| Correctness / execution | **D** | P0 breaks the core workflow; 17 backend tests non-passing |
| Security | **B−** | strong auth/audit baseline; weak document and tenant controls |
| Testing | **C** | great frontend, strong units, broken critical-path integration, no CI |
| Integrations | **F** (real) / **A−** (honesty of seams) | nothing connected; simulation is correctly labelled |
| Operability | **D+** | health endpoint and migrations only; no CI/containers/metrics/backup |

**Overall: a strong, unusually honest prototype at ~78 % weighted delivery, blocked from “working system” status by one P0 transactional defect and a red backend test suite. With items 1–3 of the priority list (roughly one day of work), the platform moves from “demo script” to “demonstrably working workflow”.**

---

## 10. Audit artefacts

| Report | Contents |
|---|---|
| `PROJECT_ARCHITECTURE.md` | stack, layout, layering, runtime topology, architecture verdict |
| `MODULE_WISE_AUDIT.md` | capability-level audit of all 8 modules |
| `REQUIREMENT_TRACEABILITY_MATRIX.md` | 127-row matrix + baseline limitation |
| `GOVERNMENT_INTEGRATION_AUDIT.md` | PFMS/DBT, Bhuvan, BhuNaksha, Ferfar, 7-12/8A, e-mail/SMS |
| `DATABASE_AND_API_AUDIT.md` | schema inventory/integrity, 205-endpoint API review |
| `BUGS_AND_TECHNICAL_ISSUES.md` | 28-item defect register with root causes |
| `TESTING_REPORT.md` | executed suites, per-class results, coverage gaps |
| `FINAL_GAP_ANALYSIS.md` | this summary, counts, priorities, verdict |
