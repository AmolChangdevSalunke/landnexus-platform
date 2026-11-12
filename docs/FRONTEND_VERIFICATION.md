# Frontend Verification — PHASE V (read-only)

**Project:** LandNexus — Unified Digital Land Acquisition Platform
**Scope:** `D:\landnexus-platform\LandNexus-frontend`
**Date:** 10 November 2026
**Mode:** PHASE V — फक्त वाचन (read-only). या phase मध्ये एकही source file बदललेली नाही. फक्त हा एकच नवीन file तयार केला आहे.
**Ground truth:** `docs/openapi.json` repo मध्ये नाही. म्हणून backend controllers (`landnexus-backend/src/main/java/com/landnexus/**/api/*Controller.java`) हे API चे ground truth मानले आहेत.

---

## 0. सारांश (एका नजरेेत)

| मुद्दा | निकाल |
|---|---|
| `npm run build` | **PASS** — exit 0, `✓ built in 44.97s` |
| `npm run test` | **PASS** — `Test Files 30 passed (30)`, `Tests 146 passed (146)` |
| Backend endpoints | **196** endpoints / **32** controllers |
| Frontend API functions | **146** functions / 11 modules; **126** UI मधून वापरले, **20** वापरले नाहीत |
| UI मधून reachable endpoints | **164 / 196 ≈ 84%** |
| 30 pages पैकी REAL | **13 / 30 ≈ 43%** |
| 30 pages पैकी PARTIAL | **10 / 30 ≈ 33%** |
| 30 pages पैकी MISSING | **6 / 30 = 20%** |
| 30 pages पैकी PLACEHOLDER | **1 / 30 ≈ 3%** |
| सर्वात मोठी जागा | Dashboards, Monitoring/SLA, MIS reports, Password/security UI, System settings |

**मुख्य निष्कर्ष:** backend खूप पुढे आहे; frontend ने acquisition, land records, proposals, GIS आणि admin हे मुख्य प्रवाह चांगले जोडले आहेत. पण **dashboard / monitoring / MIS / settings / password** हे भाग जवळपास पूर्णपणे गायब आहेत. त्यामुळे demo मध्ये “platform complete” दाखवणे आत्ता शक्य नाही.

---

## 1. V1 — Commands, build, test, environment, routes

### 1.1 Environment

| Item | Value |
|---|---|
| OS | Windows (win32) |
| Node | `v25.0.0` |
| npm | `11.6.2` |
| Frontend root | `D:\landnexus-platform\LandNexus-frontend` |
| Build script | `tsc -b && vite build` |
| Test script | `vitest run` |

### 1.2 Build — exact result

Command:

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm run build
```

Observed output (important lines):

```text
✓ 1885 modules transformed.
dist/assets/index-O_qy4FNz.js    765.03 kB │ gzip: 207.72 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 44.97s
```

- Exit code: **0**
- Verdict: **PASS**
- Warning: main chunk `765.03 kB` (> 500 kB). कारण `src/app/router.tsx` मध्ये सर्व pages eager import आहेत; route-level code splitting नाही.

### 1.3 Test — exact result

Command:

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm run test
```

Observed output (important lines):

```text
 Test Files  30 passed (30)
      Tests  146 passed (146)
   Duration  103.02s (transform 16.55s, setup 61.08s, import 33.51s, tests 63.36s, environment 127.86s)
```

- Exit code: **0**
- Verdict: **PASS**
- Test files: 30
- Tests: 146
- Note: `--localstorage-file was provided without a valid path` हे Node warnings आहेत, test failures नाहीत.
- Coverage gap: monitoring, imagery, password आणि नवीन reports/settings साठी एकही test नाही.

### 1.4 Git status (repo root, PHASE V च्या सुरुवातीला)

```text
 M scripts/full-demo.ps1
?? build-out.txt
?? docs/docs/
?? scripts/export-openapi.ps1
?? test-out.txt
```

- `scripts/full-demo.ps1` — आधीपासून modified; PHASE V ने बदललेला नाही.
- `build-out.txt`, `test-out.txt` — या phase मधील build/test logs; phase संपल्यावर काढून टाकले.
- `docs/docs/IMAGERY_SETUP.md` — चुकीच्या path मध्ये पडलेली untracked file; या phase मध्ये हलवलेली नाही.
- `scripts/export-openapi.ps1` — untracked; `docs/openapi.json` तयार करण्याचा प्रयत्न असलेला script.
- **कोणतेही git commit / push केलेले नाही.**

### 1.5 Route inventory (`src/app/router.tsx`)

Public routes:

| Path | Page |
|---|---|
| `/login` | LoginPage |
| `/forgot-password` | ForgotPasswordPage (placeholder) |

Protected shell (`AppLayout`):

| Path | Page |
|---|---|
| `/` | MyWorkPage |
| `/proposals` | ProposalListPage |
| `/proposals/new` | ProposalFormPage |
| `/proposals/:id` | ProposalDetailsPage |
| `/proposals/:id/edit` | ProposalFormPage |
| `/projects` | ProjectListPage |
| `/projects/:id` | ProjectDetailsPage |
| `/gis` | GisMapPage |
| `/land/parcels` | ParcelListPage |
| `/land/parcels/new` | ParcelFormPage |
| `/land/parcels/:id` | ParcelDetailsPage |
| `/land/parcels/:id/edit` | ParcelFormPage |
| `/land/landowners` | LandownerListPage |
| `/acquisition` | CaseListPage |
| `/acquisition/new` | CaseFormPage |
| `/acquisition/my-surveys` | MySurveysPage |
| `/acquisition/:id/surveys/:caseParcelId/new` | SurveyFormPage |
| `/acquisition/:id` | CaseDetailsPage |
| `/compensation/rules` | RateRulesPage |
| `/compensation/rr/benefits` | BenefitCataloguePage |
| `/notifications` | NotificationListPage |
| `/admin` | redirect → `/admin/master/ministries` |
| `/admin/master/ministries` | MasterDataPage |
| `/admin/master/:resource` | MasterDataPage |
| `/admin/users` | UsersPage |
| `/admin/roles` | RolesPage |
| `/admin/audit` | AuditTrailPage |
| `/admin/logins` | LoginHistoryPage |
| `/404` | NotFoundPage |
| `/403` | NoAccessPage |
| `/roadmap` | redirect → `/roadmap/valuation-compensation` |
| `/roadmap/gis` | redirect → `/gis` |
| `/roadmap/:module` | RoadmapPage |
| `*` | NotFoundPage |

**Route gaps:** dashboard, monitoring/SLA, reports/MIS, system settings, imagery, standalone document register, change-password — यासाठी एकही route नाही.

---

## 2. V2 — Full API coverage matrix

### 2.1 Method

1. Backend: 32 `*Controller.java` files, एकूण **196** endpoint annotations (`@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`).
2. Frontend: `src/api/*.ts` मधील exported functions — **146**.
3. प्रत्येक function features/components/app मध्ये वापरले आहे का ते grep ने तपासले.
4. Function → endpoint mapping 1:1 नाही. उदा. `listMaster()` हे 7 master resources च्या list endpoint ला जाते; `performProposalAction()` हे 7 workflow endpoints ला जाते. म्हणून खाली endpoint-level आणि function-level असे दोन्ही दिले आहेत.

### 2.2 Module-wise matrix

| # | Module | Backend controllers | Endpoints | Frontend file | Functions (total / used) | UI-reachable endpoints | Gap |
|---|---|---|---|---|---|---|---|
| 1 | Auth + password | AuthController, PasswordController | 7 | `api/auth.ts`, `api/client.ts` | 3 / 3 (+ refresh built-in) | 4 | change-password, reset-password, issue-reset-code — **3 missing** |
| 2 | Administration + master data | State, Division, District, Taluka, Village, Department, Ministry, User, Role, Audit, GeoScope | 54 | `api/admin.ts`, `api/administration.ts` | 20 / 15 | 45 | master `get-by-id` ×7, user `get-by-id`, `my-districts` — **9 unused** |
| 3 | Projects | ProjectController | 2 | `api/projects.ts` | 2 / 2 | 2 | — |
| 4 | Proposals | ProposalController | 13 | `api/proposals.ts` | 7 / 7 | 13 | — (generic action function all workflow endpoints cover करते) |
| 5 | Land records + documents | Parcel, Landowner, ParcelRecords, Document | 24 | `api/landRecords.ts` | 23 / 22 | 23 | `getDocument` unused — **1** |
| 6 | Acquisition lifecycle | Acquisition, AcquisitionLifecycle | 34 | `api/acquisition.ts` | 34 / 34 | 34 | — |
| 7 | Compensation / payments / R&R | Compensation, Payment, Rr | 34 | `api/compensation.ts` | 34 / 31 | 31 | `getRuleSet`, `getValuation`, `getRrCase` unused — **3** |
| 8 | GIS + conflicts | Gis, GisConflict, Imagery | 13 | `api/gis.ts` | 10 / 9 | 9 | imagery status/map/test **3 missing**, `getVillageParcels` unused — **4** |
| 9 | Monitoring / SLA / forecast | Monitoring, Sla, Forecast | 11 | `api/monitoring.ts` | 10 / 0 | **0** | **संपूर्ण module unwired** + forecast function नाही |
| 10 | Notifications | NotificationController | 3 | `api/notifications.ts` | 3 / 3 | 3 | — |
| 11 | Meta / OpenAPI | MetaController | 1 | — | 0 / 0 | 0 | `/meta/openapi.json` — **1** |
| | **Total** | **32 controllers** | **196** | **11 files** | **146 / 126** | **164** | **32 endpoints UI मध्ये नाहीत** |

**Endpoint reachability:** `164 / 196 = 83.7%` ≈ **84%**.
**Function usage:** `126 / 146 = 86.3%`.

### 2.3 Defined but unused API functions (20)

| File | Function | कारण |
|---|---|---|
| `api/admin.ts` | `getUser` | UsersPage list मधूनच data वापरते; detail fetch नाही |
| `api/administration.ts` | `getMyDistricts` | GeoScope scope UI मध्ये वापरले नाही |
| `api/administration.ts` | `getDepartments` | master list generic function मधून होते |
| `api/administration.ts` | `getTalukas` | वरीलप्रमाणे |
| `api/administration.ts` | `getVillages` | वरीलप्रमाणे |
| `api/compensation.ts` | `getRuleSet` | rule-set detail screen नाही |
| `api/compensation.ts` | `getValuation` | valuation detail screen नाही (tab list वापरते) |
| `api/compensation.ts` | `getRrCase` | R&R detail screen नाही |
| `api/gis.ts` | `getVillageParcels` | village-level parcel list UI नाही |
| `api/landRecords.ts` | `getDocument` | document metadata detail UI नाही |
| `api/monitoring.ts` | `getDashboard` | dashboard page नाही |
| `api/monitoring.ts` | `getReportCatalogue` | reports page नाही |
| `api/monitoring.ts` | `runReport` | reports page नाही |
| `api/monitoring.ts` | `exportReportCsv` | reports page नाही |
| `api/monitoring.ts` | `getSlaOverview` | SLA page नाही |
| `api/monitoring.ts` | `getSlaRules` | SLA page नाही |
| `api/monitoring.ts` | `updateSlaRule` | SLA page नाही |
| `api/monitoring.ts` | `scanSla` | SLA page नाही |
| `api/monitoring.ts` | `getEscalations` | escalation page नाही |
| `api/monitoring.ts` | `getSettings` | settings page नाही |

### 2.4 Backend endpoints with no frontend client function

| Endpoint group | Count | Notes |
|---|---|---|
| `POST /auth/change-password` | 1 | backend मध्ये आहे; UI मध्ये नाही |
| `POST /auth/reset-password` | 1 | public endpoint; UI मध्ये नाही |
| `POST /administration/users/{id}/password-reset` | 1 | admin issue code; UI मध्ये नाही |
| `GET /gis/imagery/status` | 1 | कोणतेही client function नाही |
| `GET /gis/imagery/map` | 1 | कोणतेही client function नाही |
| `POST /gis/imagery/test` | 1 | कोणतेही client function नाही |
| `GET /monitoring/forecast` | 1 | कोणतेही client function नाही |
| `GET /meta/openapi.json` | 1 | हेतूपूर्वक UI मध्ये नाही |
| Master-data `GET /{id}` (7 resources) | 7 | generic `getMaster` नाही |
| **Total** | **15** | उर्वरित 17 endpoints client function असूनही UI मध्ये वापरले नाहीत |

### 2.5 API निष्कर्ष

- **चांगले:** acquisition (34/34), proposals (13/13), projects (2/2), notifications (3/3), land records (23/24), admin (45/54) — हे प्रवाह पूर्ण जोडलेले आहेत.
- **पूर्ण गायब:** monitoring/SLA/forecast (0/11), imagery (0/3), password (0/3), meta (0/1).
- **अर्धवट:** compensation detail functions (3), master get-by-id (7), GIS village parcels (1).
- **महत्त्वाचे:** `api/monitoring.ts` मधील 10 पैकी एकही function कोणत्याही page/component मध्ये import केलेले नाही. म्हणजे dashboard/MIS/SLA/settings चा frontend भाग अस्तित्वातच नाही.

---

## 3. V3 — 30-page verification matrix

Status ची व्याख्या:

- **REAL** — route आहे, backend ला जोडलेली आहे, data दिसते, action चालतो, test आहे.
- **PARTIAL** — route/tab आहे पण काही आवश्यक भाग नाहीत (queue, standalone register, print, full workflow).
- **MISSING** — page/route नाही.
- **PLACEHOLDER** — page आहे पण “उपलब्ध नाही” असे दाखवते.

| # | Page | Route | File | Status | Evidence / gap |
|---|---|---|---|---|---|
| 1 | Login | `/login` | `features/auth/LoginPage.tsx` | **PARTIAL** | username/password, show-password, redirect चालते. 429 countdown नाही, CapsLock hint नाही, button text `Sign in securely` (line 177). |
| 2 | Forgot password | `/forgot-password` | `features/auth/ForgotPasswordPage.tsx` | **PLACEHOLDER** | line 12–15: “Password reset is not available yet… does not have a … API yet” — **हे विधान चुकीचे आहे**, backend मध्ये PasswordController आहे. |
| 3 | State dashboard | — | — | **MISSING** | route नाही; `getDashboard` unused. |
| 4 | District dashboard | — | — | **MISSING** | route नाही. |
| 5 | Project dashboard | — | — | **MISSING** | route नाही. |
| 6 | Project list | `/projects` | `features/projects/ProjectListPage.tsx` | **REAL** | list, filter, pagination; `ProjectListPage.test.tsx`. |
| 7 | Project details | `/projects/:id` | `features/projects/ProjectDetailsPage.tsx` | **REAL** | details + related data; `ProjectDetailsPage.test.tsx`. |
| 8 | Create project | `/proposals/new` → approval | `features/proposals/ProposalFormPage.tsx` | **REAL (by design)** | Project थेट create होत नाही; proposal approve झाल्यावर project तयार होतो. हे design मान्य आहे. |
| 9 | Proposal form | `/proposals/new`, `/:id/edit` | `features/proposals/ProposalFormPage.tsx` | **REAL** | create/update + validation; `ProposalFormPage.test.tsx`. |
| 10 | Proposal scrutiny queue | `/proposals` | `features/proposals/ProposalListPage.tsx` | **PARTIAL** | status/district filter आहे, पण dedicated scrutiny queue, assignment, “start scrutiny” यांची स्वतंत्र यादी नाही. |
| 11 | Proposal details | `/proposals/:id` | `features/proposals/ProposalDetailsPage.tsx` | **REAL** | history, versions, workflow actions; `ActionBar.test.tsx`. |
| 12 | Land records | `/land/parcels` | `features/landRecords/ParcelListPage.tsx` | **REAL** | list/filter/pagination + parcel create. |
| 13 | Parcel details | `/land/parcels/:id` | `features/landRecords/ParcelDetailsPage.tsx` | **REAL** | 6 tabs: Overview, Owners, Mutations, 7/12 & 8A, Documents, Boundary; tests आहेत. |
| 14 | Document register | Parcel tab only | `features/landRecords/DocumentsTab.tsx` | **PARTIAL** | upload/download/verify tab मध्ये आहे; सर्व parcel एकत्र दिसणारा standalone register/search नाही. |
| 15 | Acquisition cases | `/acquisition` | `features/acquisition/CaseListPage.tsx` | **REAL** | list/filter/create; `CasePages.test.tsx`. |
| 16 | Field survey | `/acquisition/my-surveys`, `.../new` | `MySurveysPage.tsx`, `SurveyFormPage.tsx` | **REAL** | photo upload (FormData), GPS, capturedAt; `SurveyPages.test.tsx`. |
| 17 | Legal notifications | Case tab | `CaseDetailsPage.tsx` (Notices) | **PARTIAL** | tab मध्ये list/action आहे; स्वतंत्र notices register, print/issue letter नाही. |
| 18 | Objections | Case tab | `CaseDetailsPage.tsx` (Objections) | **PARTIAL** | tab मध्ये आहे; objection hearing/disposal चा full flow नाही. |
| 19 | Award & possession | Case tabs | `CaseDetailsPage.tsx` (Award, Possession) | **PARTIAL** | actions आहेत; award letter generation/print नाही. `AwardPossession.test.tsx` आहे. |
| 20 | Valuation | Case tab | `compensation/ValuationTab.tsx` | **PARTIAL** | tab आहे; `getValuation` detail function unused. |
| 21 | Compensation & payments | Case tabs | `PaymentsTab.tsx`, `CompensationTab.tsx` | **PARTIAL** | server summary amounts, payment workflow; bank/account fields जाणीवपूर्वक नाहीत (test asserts). |
| 22 | R&R | Case tab + `/compensation/rr/benefits` | `RrTab.tsx`, `BenefitCataloguePage.tsx` | **PARTIAL** | tab + catalogue आहे; `getRrCase` detail unused, benefit assignment चा full flow नाही. |
| 23 | GIS map | `/gis` | `features/gis/GisMapPage.tsx` | **REAL** | layers, parcel geometry, project view; `GisMapPage.test.tsx`. |
| 24 | Spatial conflicts | Project/parcel details | conflict report in details pages | **PARTIAL** | dedicated conflict workspace नाही; `GisMapPage.tsx:337` comment नुसार conflict report details pages वर आहे. |
| 25 | Monitoring dashboard | — | — | **MISSING** | 10 monitoring functions पैकी 0 वापरले; forecast function नाही. |
| 26 | MIS reports | — | — | **MISSING** | `getReportCatalogue`, `runReport`, `exportReportCsv` unused. |
| 27 | Audit history | `/admin/audit` | `features/admin/users/AuditTrailPage.tsx` | **REAL** | filter + pagination; `AuditTrailPage.test.tsx`. |
| 28 | User management | `/admin/users` | `features/admin/users/UsersPage.tsx` | **REAL** | create, roles, enable/disable, scopes; `UsersPage.test.tsx`. |
| 29 | Roles | `/admin/roles` | `features/admin/users/RolesPage.tsx` | **REAL (read-only)** | backend मध्ये role-edit endpoint नाही; page हे स्पष्ट सांगते (line 32); `RolesPage.test.tsx`. |
| 30 | System settings | — | — | **MISSING** | `getSettings` unused; settings route/page नाही. |

### 3.1 Page counts

| Status | Count | Percentage |
|---|---|---|
| REAL | 13 | 43% |
| PARTIAL | 10 | 33% |
| MISSING | 6 | 20% |
| PLACEHOLDER | 1 | 3% |
| **Total** | **30** | **100%** |

REAL pages: 6, 7, 8, 9, 11, 12, 13, 15, 16, 23, 27, 28, 29.
PARTIAL pages: 1, 10, 14, 17, 18, 19, 20, 21, 22, 24.
MISSING pages: 3, 4, 5, 25, 26, 30.
PLACEHOLDER page: 2.

---

## 4. V4 — Code-quality evidence (file:line)

### 4.1 Security / session handling — चांगले

| Area | Evidence | Verdict |
|---|---|---|
| Access token memory मध्येच | `src/api/client.ts:25` — `let accessToken: string \| null = null` | ✅ localStorage मध्ये नाही |
| Refresh token sessionStorage | `src/api/client.ts:37,46,48` | ✅ tab बंद झाल्यावर जातो |
| Single-flight refresh | `src/api/client.ts:110–143` — `refreshPromise` | ✅ एकाच वेळी अनेक refresh नाहीत |
| 401 → refresh → retry | `src/api/client.ts:190–227` | ✅ पण 429 handling नाही |
| No global Content-Type | `src/api/client.ts:166–171` | ✅ FormData boundary सुरक्षित |
| Permissions फक्त `/auth/me` वरून | `src/features/auth/useAuth.ts:13–24` | ✅ JWT decode करून permissions वाचत नाही |
| Workflow buttons server-driven | `acquisition/ActionBar.tsx:64`, `proposals/ActionBar.tsx:123`, `PaymentsTab.tsx:212`, `ValuationTab.tsx:544`, `RrTab.tsx:210` — `availableActions` | ✅ UI backend ला override करत नाही |
| Sensitive fields नाहीत | `Compensation.test.tsx:180–205,247` — `not.toMatch(/bank\|account\|ifsc\|caste\|religion/i)` | ✅ |

### 4.2 Data handling — चांगले

| Area | Evidence | Verdict |
|---|---|---|
| Blob downloads | `api/landRecords.ts:302`, `api/acquisition.ts:258`, `api/monitoring.ts:85` | ✅ `responseType: 'blob'` |
| FormData uploads | `api/landRecords.ts:227,246`, `api/acquisition.ts:202` | ✅ manual Content-Type नाही |
| Money formatting | `utils/format.ts:57–68` — `Intl.NumberFormat('en-IN', { currency: 'INR' })` | ✅ |
| Browser मध्ये पैसे बेरीज नाही | फक्त `OwnersTab` मध्ये `sharePercent` reduce आणि geometry sum | ✅ server totals वापरतो |
| Date/number locale | `utils/format.ts:1–20` — `en-IN`, 24-hour | ✅ |
| No console noise | `console.log/debug/info` = **0** (legacy prototype वगळून) | ✅ |
| No localStorage | `src` मध्ये (legacy वगळून) = **0** | ✅ |

### 4.3 Accessibility / UX — चांगले

| Area | Evidence | Verdict |
|---|---|---|
| Skip link | `components/layout/AppLayout.tsx:30–32` | ✅ |
| Error boundary | `components/layout/ErrorBoundary.tsx` | ✅ |
| Network banner | `components/layout/NetworkBanner.tsx` + `NETWORK_ERROR_EVENT` | ✅ |
| Empty / loading / error states | `components/ui/EmptyState.tsx`, `ErrorState.tsx`, `Skeleton.tsx` | ✅ |
| Sidebar responsive + test | `components/layout/Sidebar.tsx`, `Sidebar.test.tsx` | ✅ |
| Focus/aria on dialogs | `components/ui/Modal.tsx`, `ConfirmDialog.tsx` | ✅ (spot check) |

### 4.4 Gaps — सुधारणा आवश्यक

| Area | Evidence | Verdict |
|---|---|---|
| 429 / Retry-After | संपूर्ण `src` मध्ये `429`, `Retry-After`, `retryAfter` = **0** | ❌ rate-limit UX नाही |
| CapsLock hint | `CapsLock`, `getModifierState` = **0** | ❌ |
| Reduced motion | `prefers-reduced-motion` = **0** | ❌ |
| Tabular numbers | `tabular-nums` = **0** | ❌ आकड्यांची alignment कमी |
| i18n centralization | `i18n` / `useTranslation` / `FormattedMessage` = **0**; strings inline | ❌ Marathi साठी मोठे काम |
| Route-level code splitting | `src/app/router.tsx` — सर्व pages eager import | ❌ 765 kB main chunk |
| Monitoring tests | `src/test/handlers.ts` मध्ये monitoring/imagery/password handlers नाहीत | ❌ |

---

## 5. V5 — UI spot-checks (section U विरुद्ध)

> Section U चा शब्दशः मजकूर repo मध्ये साठवलेला नाही (phase prompt मध्ये होता). खालील तपासणी त्या prompt मधील area-wise expectations विरुद्ध आहे. काही U-item या table मध्ये राहिले असेल तर सांगा, मी वेगळे नोंदवेन.

| Area | Expectation (section U) | Actual | Status |
|---|---|---|---|
| Colour palette | Navy `#1F4E79` कुटुंब | `tailwind.config.js:6–54` — `navy.900 = #0B1F3A`, वेगळी shades | ⚠️ Drift |
| Max content width | 1280 px | `AppLayout.tsx:52,55` — `max-w-[1600px]` | ⚠️ Drift |
| Footer | Version + demo banner | `AppLayout.tsx:55–58` — फक्त tagline + audit line | ❌ |
| Devanagari font | Marathi fallback | `tailwind.config.js:55–68` — Inter/system-ui; Devanagari नाही | ❌ |
| Login | 429 countdown, CapsLock | दोन्ही नाही; `LoginPage.tsx:177` — `Sign in securely` | ❌ |
| Forgot password | Reset flow | `ForgotPasswordPage.tsx:12–15` — “not available”; backend मात्र तयार | ❌ |
| Header | Change password | `Header.tsx` — फक्त notifications + logout (line 152, 219) | ❌ |
| Role-specific home | U5 प्रमाणे प्रत्येक role ला स्वतःचे home | `MyWorkPage.tsx:35–47` — permission-based generic tiles | ⚠️ Partial |
| Sidebar | Monitoring / Reports / Settings | `navigation.ts` — फक्त roadmap link (line 157), खरे pages नाहीत | ❌ |
| Tables | Sort/filter/pagination/empty | `components/ui/DataTable.tsx` + pages | ✅ |
| Forms | Labels, validation, error text | `components/ui/Input.tsx`, `Select.tsx`, `Textarea.tsx` | ✅ |
| Dialogs | Confirm before destructive action | `ConfirmDialog.tsx` | ✅ |
| Toasts | Success/error feedback | `ToastHost.tsx`, `app/toastsSlice.ts` | ✅ |
| Responsive | Mobile sidebar, stacking | `Sidebar.tsx`, `AppLayout.tsx` | ✅ |
| Loading | Skeletons, not blank | `Skeleton.tsx` | ✅ |

**V5 निष्कर्ष:** functional UI चांगले आहे; design-system consistency (palette, width, footer, font) आणि security-related micro-UX (429, CapsLock, change-password) हे drift आहेत.

---

## 6. V6 — New backend behaviour चे UI coverage

| Backend behaviour | Endpoint(s) | Frontend client | UI | Verdict |
|---|---|---|---|---|
| Change own password | `POST /auth/change-password` | ❌ | ❌ | **गायब** |
| Self-service reset (code) | `POST /auth/reset-password` | ❌ | ❌ | **गायब** (Forgot page चुकीचे सांगते) |
| Admin issue reset code | `POST /administration/users/{id}/password-reset` | ❌ | ❌ | **गायब** |
| Rate limit 429 + Retry-After | `RateLimitFilter` | N/A | ❌ | **गायब** |
| Monitoring dashboard | `GET /monitoring/dashboard` | ✅ | ❌ | **गायब** |
| Report catalogue / run / CSV | `GET /monitoring/reports`, `GET /monitoring/reports/{code}`, `GET .../export` | ✅ | ❌ | **गायब** |
| Forecast | `GET /monitoring/forecast` | ❌ | ❌ | **गायब** |
| SLA overview / rules / scan / escalations | `GET/PUT /monitoring/sla*` | ✅ (rules scan) | ❌ | **गायब** |
| Settings | `GET /monitoring/settings` | ✅ | ❌ | **गायब** |
| Imagery status / map / test | `/gis/imagery/*` | ❌ | ❌ | **गायब** |
| GIS conflicts | `/gis/conflicts*` | ✅ | ⚠️ details tabs मध्ये | अर्धवट |
| Audit + login history | `/administration/audit*` | ✅ | ✅ | ✅ |
| Notifications unread count | `/notifications/unread-count` | ✅ | ✅ | ✅ |
| GeoScope my-districts | `/administration/geo-scope/my-districts` | ✅ | ❌ | **गायब** |
| Master get-by-id | 7 × `GET /{id}` | ❌ | ❌ | **गायब** (आवश्यकता कमी) |
| Meta OpenAPI | `GET /meta/openapi.json` | ❌ | ❌ | हेतूपूर्वक नाही |

**V6 निष्कर्ष:** backend नंतर जोडलेले security, monitoring, reporting, imagery हे भाग frontend मध्ये आलेले नाहीत. हेच PHASE U चे मुख्य काम आहे.

---

## 7. V7 — अंतिम निष्कर्ष, risks, प्रश्न, fix plan

### 7.1 आकडे

- **API:** 196 endpoints; 164 UI-reachable (**84%**); 20 client functions unused; monitoring 0/11.
- **Pages:** 13 REAL (43%), 10 PARTIAL (33%), 6 MISSING (20%), 1 PLACEHOLDER (3%).
- **Demo-complete (judgement):** ~55–60%. कारण dashboards, monitoring, MIS, settings, password UI नसल्याने “end-to-end platform” दाखवता येत नाही.

### 7.2 Demo महत्त्वानुसार gaps (उतरत्या क्रमाने)

| Priority | Gap | Pages | API | Demo impact |
|---|---|---|---|---|
| **P0** | State / District / Project dashboards | 3–5 | `getDashboard` unused | पहिला 2 मिनिटांचा impression |
| **P0** | Monitoring / SLA / escalations / forecast | 25 | 0/11 wired; forecast function नाही | “governance” story राहते |
| **P0** | MIS reports + CSV export | 26 | 3 functions unused | officers साठी महत्त्वाचे |
| **P1** | Password/security UI (forgot, change, issue-reset) + 429 UX | 2, login, header | 3 endpoints, 0 client | security demo आणि trust |
| **P1** | System settings | 30 | `getSettings` unused | admin completeness |
| **P2** | Standalone document register | 14 | `getDocument` unused | land records depth |
| **P2** | Dedicated spatial-conflict workspace | 24 | conflicts wired, UI अर्धवट | GIS depth |
| **P2** | Imagery UI | — | 3 endpoints, 0 client | advanced GIS |
| **P3** | Design tokens, Devanagari font, footer, i18n, code splitting | — | — | polish / Marathi readiness |

### 7.3 Risks

1. **चुकीची UI माहिती:** ForgotPasswordPage backend API असूनही “API नाही” असे सांगते. हे demo मध्ये विचारले जाऊ शकते.
2. **429 अनाहूत:** login rate-limit झाल्यास user ला generic error दिसेल; `Retry-After` दाखवला जात नाही.
3. **Monitoring पूर्ण untested:** नवीन pages जोडताना `src/test/handlers.ts` मध्ये MSW handlers लागतील; अन्यथा tests लिहिता येणार नाहीत.
4. **Bundle size:** 765 kB main chunk; कमी network वर पहिले load हळू.
5. **Design drift:** palette/width/footer/font बदलल्यास अनेक screens चे visual regression होऊ शकते; screenshot tests नाहीत.
6. **i18n नाही:** सर्व strings inline; Marathi translation नंतर मोठे refactor होईल.
7. **Untracked files:** `docs/docs/IMAGERY_SETUP.md`, `scripts/export-openapi.ps1` — commit करण्यापूर्वी योग्य path ठरवा.
8. **Modified demo script:** `scripts/full-demo.ps1` आधीपासून modified; demo आधी त्याचा फरक तपासा.

### 7.4 खुल्या प्रश्न (उत्तरांशिवाय पुढे जाणार नाही)

1. **Dashboards:** state/district/project — तीनही `/monitoring/dashboard` च्या एकाच response वरून बनवायचे का, की प्रत्येकासाठी वेगळा endpoint अपेक्षित आहे?
2. **Password UI:** F12 मध्ये change-password + reset + admin issue-reset तीनही करायचे का? (backend तयार आहे)
3. **Design tokens:** `#1F4E79` palette आणि 1280 px width ला जायचे का, की सध्याचे navy/1600px ठेवायचे?
4. **Imagery:** F9 मध्ये imagery UI करायचा का, की backend configuration (`IMAGERY_SETUP.md`) आधी स्थिर करायचा?
5. **i18n:** आत्ताच central strings file काढायचा का, की F13 मध्ये?
6. **Create project:** “proposal approve → project तयार” हे by-design मान्य आहे का?
7. **Master get-by-id:** edit साठी row data पुरते; `GET /{id}` UI मध्ये नको का?

### 7.5 Fix plan — F6 ते F13

> नियम: प्रत्येक phase एका reply मध्ये; प्रत्येक phase नंतर `npm run build` + `npm run test`; एक local commit; नवीन runtime dependency आधी विचारल्याशिवाय नाही. `recharts` + सध्याचे UI kit पुरते.

| Phase | Scope | मुख्य files | Acceptance |
|---|---|---|---|
| **F6** | Land records: standalone document register (`/land/documents`), filters, verify/download; `getDocument` wire; parcel mutations/7-12 completeness | `features/landRecords/*`, `app/router.tsx`, `app/navigation.ts`, `api/landRecords.ts` | register search/filter, upload/download/verify; tests |
| **F7** | Acquisition: notices/objections/award/possession चे dedicated pages किंवा complete tab actions; सर्व lifecycle transitions expose | `features/acquisition/*`, `CaseDetailsPage.tsx` | प्रत्येक transition availableActions नुसार चालेल; tests |
| **F8** | Compensation/payments/R&R: valuation detail, payment batch, R&R benefit assignment; `getValuation`, `getRrCase`, `getRuleSet` wire | `features/compensation/*`, `api/compensation.ts` | server totals, no bank fields; tests |
| **F9** | Maps/conflicts: dedicated conflict workspace; imagery status/map/test client + UI; `getVillageParcels` | `features/gis/*`, `api/gis.ts` | conflict list + map; imagery status graceful fallback; tests |
| **F10** | Dashboards + MIS: `/dashboard` (role-aware state/district/project), `/monitoring`, `/reports` catalogue/run/CSV, forecast chart (recharts) | नवीन `features/dashboard/*`, `features/reports/*`, `api/monitoring.ts`, `navigation.ts` | KPIs, charts, CSV download; tests |
| **F11** | Monitoring/settings: SLA rules edit, scan, escalations, `/settings` read-only; `getSettings` wire | `features/monitoring/*`, `features/settings/*` | SLA scan + escalation list; settings दिसतात; tests |
| **F12** | Security UI: change-password, reset-password, admin issue-reset; 429/Retry-After countdown; CapsLock hint; Forgot page दुरुस्ती. **सुरुवातीला `docs/FRONTEND_BUILD_PROMPT.md` मध्ये U9 contract append करा.** | `features/auth/*`, `components/layout/Header.tsx`, `api/auth.ts`, `api/client.ts` | तीनही password flows; 429 countdown; tests |
| **F13** | Polish: `#1F4E79` tokens, 1280 px, Devanagari fallback, footer version/demo banner, i18n string file, route-level code splitting, reduced-motion/tabular-nums | `tailwind.config.js`, `AppLayout.tsx`, `router.tsx`, `src/i18n/*` | visual consistency, chunk < 500 kB, tests |

### 7.6 Manual try steps (आत्ता काय तपासता येईल)

1. `cd D:\landnexus-platform\LandNexus-frontend`
2. `npm run dev` → `http://localhost:5173`
3. Backend `http://localhost:8080` चालू असल्यास login करा.
4. तपासा: `/projects` → project list → details; `/land/parcels` → parcel details tabs; `/acquisition` → case details tabs; `/gis`; `/admin/users`; `/admin/audit`.
5. तपासा की `/dashboard`, `/monitoring`, `/reports`, `/settings` — **404** येतात (हेच gaps).
6. `/forgot-password` उघडा — “API नाही” असे दिसते, पण backend मध्ये endpoint आहे (V6 पहा).

---

## 8. पुढील पायरी

PHASE V इथे थांबते. वरील अहवाल वाचल्यावर **“go”** दिल्यास PHASE U सुरू होईल — F6 पासून, एक phase प्रति reply, build/test + local commit सह.

**आत्ता कोणतेही source file बदललेले नाहीत. कोणताही commit/push केलेला नाही.**
