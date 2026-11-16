# 7. Testing Report — LandNexus / NLAMS

**Audit date:** 14 November 2026
**Nature:** the audit **executed** the existing test suites and build. No test, source or configuration file was modified.
**Evidence logs (retained on the audit workstation):**

- Backend: `C:\Users\amols\AppData\Local\Temp\opencode\audit-backend-tests.log`
- Frontend tests: `C:\Users\amols\AppData\Local\Temp\opencode\audit-frontend-tests.log`
- Frontend build: `C:\Users\amols\AppData\Local\Temp\opencode\audit-frontend-build.log`

---

## 1. Results at a glance

| Suite | Command | Result | Counts | Duration | Verdict |
|---|---|---|---|---|---|
| Backend unit + integration | `.\mvnw.cmd test` | **BUILD FAILURE** | 542 tests · 519 pass · 14 fail · 3 error · 0 skipped | 6 min 06 s | **FAIL** |
| Frontend unit/component | `npm run test -- --reporter=dot` | pass | 45 files · 233 tests · 0 fail | 228.65 s | **PASS** |
| Frontend type-check + build | `npm run build` (`tsc -b && vite build`) | pass | 1 944 kB entry chunk warning | 24.22 s | **PASS** |
| Schema migration | Flyway on disposable `landnexus_audit_it` | pass | 19/19 migrations applied | — | **PASS** |
| API contract test | `OpenApiServiceTest` | pass | included in backend run | — | **PASS** |

**Overall testing status: `PARTIAL`.** The frontend is genuinely green; the backend is red, and the red tests sit on the most important business flow.

---

## 2. Environment used

| Variable | Value |
|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/landnexus_audit_it` (disposable DB; **not** `landnexus_dev`) |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / environment-supplied |
| `LANDNEXUS_TEST_DB_URL/_USERNAME/_PASSWORD` | same disposable DB |
| `JWT_SECRET` | freshly generated ≥256-bit value |
| `LANDNEXUS_STORAGE_DIR` | `C:\Users\amols\AppData\Local\Temp\opencode\landnexus_audit_storage` |
| Java | 21.0.12.1 |
| Node / npm | project default (Vite 6-era, Vitest 4.1.12) |
| PostgreSQL | 18.6 + PostGIS |

The disposable database was created for this audit and dropped afterwards. `landnexus_dev` was never used for destructive tests.

---

## 3. Backend suite — detail

### 3.1 Aggregate

```
[ERROR] Tests run: 542, Failures: 14, Errors: 3, Skipped: 0
[INFO]  Total time: 06:06 min
[ERROR] BUILD FAILURE
```

83 test classes executed (84 `*Test.java` files discovered; one abstract/support class is not a test).

### 3.2 Per-class outcome (selected, all 20 integration + representative unit classes)

| Class | Run | Fail | Error | Verdict |
|---|---|---|---|---|
| `AcquisitionIntegrationTest` | 2 | 0 | 0 | PASS |
| `AuditAndScopeIntegrationTest` | 6 | 0 | 0 | PASS |
| `AuthFlowIntegrationTest` | 8 | 0 | 0 | PASS |
| `PasswordIntegrationTest` | 2 | 1 | 0 | FAIL (test defect, BUG-004) |
| `CompensationIntegrationTest` | 5 | 0 | 0 | PASS |
| `GisIntegrationTest` | 3 | 0 | 0 | PASS |
| `LandRecordsIntegrationTest` | 5 | 0 | 0 | PASS |
| `MonitoringIntegrationTest` | — | 0 | 0 | PASS |
| `SlaIntegrationTest` | — | 0 | 0 | PASS |
| `OpenApiServiceTest` | — | 0 | 0 | PASS |
| `ProposalApprovalReliabilityIntegrationTest` | 6 | 6 | 0 | **FAIL** (BUG-002/003) |
| `ProposalApprovalRollbackIntegrationTest` | 1 | 1 | 0 | **FAIL** (BUG-002/003) |
| `ProposalWorkflowIntegrationTest` | 9 | 6 | 3 | **FAIL** (BUG-001/003) |
| `ProposalControllerTest` | 10 | 0 | 0 | PASS |
| `ProposalServiceTest` (unit) | 45 | 0 | 0 | PASS (but mock-based; missed BUG-001) |
| `DocumentServiceTest` | 14 | 0 | 0 | PASS |
| `FileValidatorTest` | 6 | 0 | 0 | PASS |
| `OwnershipServiceTest` | 10 | 0 | 0 | PASS |
| `ParcelServiceTest` | 9 | 0 | 0 | PASS |
| `LocalFileStorageTest` | 5 | 0 | 0 | PASS |
| `WorkflowDefinitionTest` | 6 | 0 | 0 | PASS |
| `TextNormalizerTest` | 3 | 0 | 0 | PASS |

### 3.3 All 17 non-passing tests

| # | Test | Failure | Root cause |
|---|---|---|---|
| 1–6 | `ProposalApprovalReliabilityIntegrationTest` (6 tests) | `Status expected:<201> but was:<400>` in `setUp:88`; suppressed `relation "parcel_owners" does not exist` in cleanup:115 | BUG-002 (department fixture missing `ministryId`/`level`), BUG-003 (stale table names) |
| 7 | `ProposalApprovalRollbackIntegrationTest` (1 test) | same fixture + cleanup | BUG-002/003 |
| 8 | `ProposalWorkflowIntegrationTest.fullWorkflow_fromDraftToApprovedProject` | submit returned 500 | BUG-001 |
| 9 | `...permissionsAndVisibility_areEnforcedByTheBackend` | expected 200, workflow action 500 | BUG-001 |
| 10 | `...rejection_needsAReason_andTheOwnerCanReopenWithoutLosingTheNumber` | 500 on submit | BUG-001 |
| 11 | `...notifications_canOnlyBeReadAndMarkedByTheirOwner` | 500 on submit | BUG-001 |
| 12 | `...proposalNumbers_areUniqueAndSequential` | 500 on submit | BUG-001 |
| 13 | `...separationOfDuties_theRecommenderCannotAlsoApprove` | 500 on submit | BUG-001 |
| 14 | `...validation_rejectsInconsistentProposals` | **ERROR** (setup/teardown path) | BUG-001/003 |
| 15 | `...list_showsConsultantsTheirOwn_andOfficersTheirScope` | **ERROR** | BUG-001/003 |
| 16 | `...endpoints_requireLogin` | **ERROR** | BUG-001/003 |
| 17 | `PasswordIntegrationTest.changePassword_checksTheOldOne_enforcesThePolicy_andEndsTheOldPassword` | `expected: 400 but was: 204` at line 125 | BUG-004 (test expectation) |

The 14 occurrences of `cannot execute nextval() in a read-only transaction` all belong to `ProposalWorkflowIntegrationTest`.

### 3.4 Why the suite did not catch the P0 defect earlier

- 45 `ProposalServiceTest` cases use Mockito mocks, no Spring proxy, no real transaction.
- The only real-transaction tests of the workflow are the 3 `AbstractIsolatedPgIntegrationTest` subclasses — and **all 3 fail in fixture/cleanup before reaching business assertions**.
- Net effect: the workflow has **no green end-to-end test at any point** in the current tree.

### 3.5 Test-safety finding (important)

`application.properties` defaults the datasource to `jdbc:postgresql://localhost:5432/landnexus_dev`. Only 3 test classes use `@ActiveProfiles("integration")` (which requires `LANDNEXUS_TEST_DB_*` and refuses the dev URL). The other ~11 `@SpringBootTest` classes have **no guard**.

Therefore, running `.\mvnw.cmd test` on a workstation **without** the environment variables points the suite at `landnexus_dev` and writes test data there. This audit avoided it by setting `DB_URL` explicitly. This is a reproducibility and safety risk (process finding, not a code defect in the product).

---

## 4. Frontend suite — detail

```
Test Files  45 passed (45)
Tests       233 passed (233)
Duration    228.65s (transform 28.42s, setup 124.64s, import 60.62s, tests 150.05s, environment 274.01s)
```

- 45 files / 233 tests, **0 failures, 0 skipped**.
- Covers feature pages, permission gates, polling hooks, notification UI, monitoring pages, proposal action bar, document upload, forms and formatting utilities.
- `npm run build` first runs `tsc -b`, so the passing build also proves the TypeScript project compiles with no type errors.
- Build output: `dist/assets/index-CGN30cyA.js` **944.34 kB** (gzip 245.32 kB) + lazy per-state map chunks (198–466 kB) + `TrendChart` 384.86 kB. Only warning: chunk size > 500 kB.

No `legacy-prototype` tests are included in the audited baseline.

---

## 5. What is **not** tested (coverage gaps)

| Area | Coverage | Comment |
|---|---|---|
| Proposal workflow end-to-end | **none green** | all 3 isolated-PG classes fail (BUG-001/002/003) |
| Approval → exactly one project + one case | **none green** | `ProposalApprovalReliabilityIntegrationTest` fails at fixture |
| Concurrency / duplicate approval | **none green** | the concurrency test is one of the 6 failing at fixture |
| Notification outbox dispatch, retries, provider adapters | unit-level only | no test against a fake HTTP provider |
| Imagery WMS proxy against a live endpoint | none | `ImageryConfig` validation only |
| PFMS/PaymentGateway | simulated path only | no contract test |
| Document malware scanning | none (feature absent) | — |
| Database constraints under real concurrency | partial | `uq_acquisition_cases_project` verified by read, not by parallel inserts |
| Accessibility / responsive UI | none | no axe/e2e suite |
| Browser end-to-end (Playwright/Cypress) | **none** | no e2e runner in the repo |
| Performance / load | none | no k6/JMeter/Gatling |
| Security scanning (SAST/DAST/dependency audit) | none in repo | no OWASP dependency-check, no Dependabot |
| Coverage percentage | **UNVERIFIED** | no JaCoCo plugin, no Vitest coverage script; cannot compute a trustworthy number |

---

## 6. Test-quality assessment

| Dimension | Rating | Reason |
|---|---|---|
| Unit-test breadth | Good | 38 `application` test classes; deterministic domain logic well covered |
| Integration depth | Weak | 17 integration classes, but the critical 3 are red and 11 lack DB safety guards |
| Frontend testing | Good | 233 passing tests across 45 files, including permission and polling behaviour |
| Build/type safety | Good | Maven compile + `tsc -b` succeed |
| Regression safety net | **Poor** | the most important flow has no green test; no CI to enforce anything |
| Reproducibility | Weak | uncommitted files, untracked demo scripts, env-dependent DB targeting |
| Coverage measurement | Absent | no instrumentation |

---

## 7. Recommended test work (for a follow-up task)

1. Fix BUG-001, then make `ProposalWorkflowIntegrationTest` assert submit → number → scrutiny → recommend → approve → project + case.
2. Fix BUG-002/003 so the reliability/rollback/concurrency classes actually run; they are the only guard against duplicate projects/cases.
3. Add `@ActiveProfiles("integration")` (or an equivalent guard) to every `@SpringBootTest` class so `mvnw test` can never touch `landnexus_dev`.
4. Add JaCoCo (backend) and `vitest --coverage` (frontend) with a documented baseline.
5. Add one end-to-end smoke test against a started application (Testcontainers or a scripted run) covering login → proposal → approval → case.
6. Add a notification-dispatch test with a fake HTTP provider (success, retry, permanent failure).
7. Add a CI workflow running backend tests against a Postgres service container and the frontend suite/build.

---

## 8. Verdict

| Question | Answer |
|---|---|
| Does the frontend pass its tests and build? | **Yes** — 233/233 tests, build pass. |
| Does the backend pass its tests? | **No** — 519/542 pass; BUILD FAILURE. |
| Is the failure caused by the product or the tests? | Mixed: **1 product P0** (BUG-001), **2 stale test fixtures** (BUG-002/003), **1 wrong test expectation** (BUG-004). |
| Is the critical business flow verified end-to-end? | **No.** |
| Is there enough automated evidence to call the platform production-ready? | **No.** |

**Testing status: `PARTIAL`** — strong unit/component coverage, broken critical-path integration coverage, no CI, no coverage metric.
