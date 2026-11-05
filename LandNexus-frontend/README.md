# LandNexus Frontend

React 18 + TypeScript + Vite frontend for the LandNexus land acquisition platform.

**Current delivery: Phase F4 (administration).** F0/F1, F2 and F3 are complete, and F4 is
implemented and verified. The app uses the real Spring Boot backend
only. There is no demo data: screens that are not connected yet show an honest "planned"
state.

## Requirements

- Node.js 18+ (an LTS release such as Node 20 or 22 is recommended)
- npm 10+
- The Spring Boot backend running on `http://localhost:8080`

## First-time setup

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm install
Copy-Item .env.example .env
```

`.env` only contains public `VITE_*` values and is git-ignored. Never put secrets in it.

## Run locally (PowerShell)

Start the backend in the first terminal:

```powershell
cd D:\landnexus-platform\landnexus-backend
.\mvnw.cmd spring-boot:run
```

Start the frontend in a second terminal:

```powershell
cd D:\landnexus-platform\LandNexus-frontend
npm run dev
```

Open `http://localhost:5173` and sign in with an account created by the backend
(or by the demo provisioning script, when you choose to run it).

## Checks

```powershell
npm run test     # Vitest + React Testing Library + MSW
npm run build    # strict TypeScript build + production bundle
npm run preview  # serve the production bundle
```

## What Phase F1 contains

- Real login, session restore and logout against `/auth/login`, `/auth/refresh`,
  `/auth/me` and `/auth/logout`
- Access token kept in memory only; one-time refresh token in `sessionStorage`
- Single-flight token refresh, so concurrent 401 responses never reuse a refresh token
- Server-provided roles, permissions and district scope (no JWT decoding in the UI)
- Permission-aware navigation and route guards (`/auth/me` is the authority)
- Error handling for 400, 401, 403, 404, 409, 500 and network failures
- Responsive application shell, accessible UI kit, toasts and error boundary
- Live account and scope data on **My work**; unread notification count from the backend

## What Phase F2 contains

- Proposals list with server-side pagination plus status and district filters
- Create/edit form with district -> taluka -> affected villages, validation and
  server field errors
- Proposal details with overview, status timeline, history and version snapshots
  (including a simple line diff against the previous version)
- Workflow action bar driven only by the backend's `availableActions`; the UI does not
  rebuild workflow rules
- Friendly handling for 400, 401, 403, 404, 409 and network errors; a 409 on an action
  reloads the proposal instead of guessing
- Real data only: no seeded proposals, counts or fake projects

## What Phase F3 contains

- Read-only government project register with district filter and server-side pagination
- Project details with status, location, department, length, estimated land area, affected
  villages and a link back to the originating proposal
- No create, edit or delete actions: projects exist only after a proposal is approved
- Paged notifications with an unread-only filter and mark-as-read
- Notification links open the related proposal or project using the backend's
  `entityType` and `entityId`
- Latest five notifications in the header dropdown plus the live unread badge
- The unread badge refreshes after a successful workflow action and when a notification is
  marked as read
- Friendly 400, 401, 403, 404, 409 and network error states; no invented records or counts

## What Phase F4 contains

- Generic master-data screens for ministries, departments, states, divisions, districts,
  talukas and villages: paged lists, parent filters (`ministryId`, `stateId`, `districtId`,
  `talukaId`), create/edit and activate/deactivate (no delete)
- Writes appear only with `MASTER_DATA_WRITE`; reads need `MASTER_DATA_READ`, matching the
  backend
- Users list with server-side pagination, account creation using the server password rules,
  full role replacement, enable/disable with confirmation, and geographic-scope editing
  (State/Division/District) that replaces the complete scope list
- Role catalogue and permission matrix from `GET /administration/roles`; read-only because
  the backend exposes no role-editing endpoint
- Audit trail with newest-first paged events, entity-type, entity-id and actor filters, and
  expandable details; strictly read-only
- Login history with newest-first paged attempts, username filter, success/failure badges,
  failure reason, IP address and user agent; strictly read-only
- SUPER_ADMIN protections mirror the backend: only a super administrator may grant
  `SUPER_ADMIN` or change a `SUPER_ADMIN` account, and self-disable is blocked
- Candidate scope lists need `MASTER_DATA_READ`; without it existing assignments can still
  be removed and saved
- Friendly 400, 401, 403, 404, 409 and network error states; no invented records or counts

## Not available yet

F5, GIS, land records, documents, field surveys and valuation are planned for later phases.
Their routes show a planned-state screen with no invented records or numbers.

The **Permission-Based Geographic Map** (Section 8.14) is approved as a concept only and
is not implemented in F4. It will be built in a later GIS phase with backend-enforced
geographic scope and permissions. See `../docs/PROJECT_PLAN.md`.

## Legacy prototype

The original single-file prototype is preserved in `src/legacy-prototype/` for reference
only. It is excluded from TypeScript compilation and is not imported by the application.

## Logo and application name

The logo is loaded from `src/assets/landnexus-logo.png`. Replace that file with a new
transparent PNG to change the logo everywhere. The application name and tagline live in
`src/utils/strings.ts` (`APP_NAME`, `APP_TAGLINE`, `APP_FULL_NAME`).
