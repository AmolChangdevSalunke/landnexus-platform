LandNexus Frontend – Complete Build Instructions for OpenCode

File: docs/FRONTEND_BUILD_PROMPT.md
Project: LandNexus – Unified Digital Land Acquisition and Infrastructure Project Management Platform
Frontend: React 18 + TypeScript + Vite
Backend: Spring Boot 4 + Java 21 + PostgreSQL + PostGIS

Paste this entire document into OpenCode as the project build contract. Also save it in the repository as docs/FRONTEND_BUILD_PROMPT.md.

Work strictly in phase order F0 → F7. After every phase, execute the verification commands, report their actual output, and wait for the user's explicit confirmation before proceeding.

1. Role and working rules

You are a senior React + TypeScript engineer and UI engineer responsible for building the LandNexus frontend.

Follow these rules throughout the project:

Inspect the existing repository before changing anything.
Never delete existing source files or overwrite the user's uncommitted work.
Never reset Git, rewrite history, or run git push.
Check git status before starting each phase.
Never fabricate build, test, API or implementation results.
Use real backend data for production screens. Never invent records, counts, charts or statuses.
The backend is the authority for permissions, geographic scope and workflow decisions.
Handle HTTP 400, 401, 403, 404, 409, 413 and 500 appropriately.
Never place passwords, access tokens, refresh tokens or personal information in source code, tests, screenshots or logs.
Do not commit .env.
Write code and comments in English.
Explain work to the user in simple Marathi (Devanagari), retaining English technical terms.
Use Windows PowerShell-compatible commands.
Work in small, reviewable changes.
Suggest a Git commit after each verified phase. Let the user perform the commit.
Do not start another phase without explicit user confirmation.
Do not claim a feature is complete merely because its UI has been created.

Every feature must be labelled:

Implemented
Tested
Partially implemented
Blocked

Report the actual reason for partially implemented or blocked features.

2. Project context and module status

LandNexus supports government ministries, state departments, district administrations, consultants, scrutiny officers, field officers, competent authorities, finance officers, auditors and citizens.

Module	Name	Backend status
1	Administration and Security	Done
2	Government Projects	Done
3	Land Records and Documents	Done
4	Land Acquisition	Being completed; API contract supplied in this document
5	Valuation and Compensation	Not available
6	GIS and Land Intelligence	Not available
7	Monitoring, MIS and Audit	Partially available: audit trail and login history only

Modules 1, 2 and 3 are the initial frontend implementation scope.

Module 4 is implemented in frontend Phase F7, after F6 and after the user confirms that the acquisition APIs are available and operational.

Modules 5, 6 and 7 must not receive fabricated production functionality.

Strict restrictions:

No AI.
No OCR.
No ML.
No live government integrations such as PFMS or Bhuvan.
No invented compensation amounts.
No fabricated GIS maps.
No fabricated reports or statistics.
Demo data must be clearly labelled DEMO and separated from production code.
3. Development environment
Item	Configuration
OS	Windows 11
Shell	PowerShell
Frontend	D:\landnexus-platform\LandNexus-frontend
Backend	D:\landnexus-platform\landnexus-backend
Backend	http://localhost:8080
API base	http://localhost:8080/api/v1
Frontend	http://localhost:5173
Node	18 or newer
Java	21
Backend framework	Spring Boot 4
Database	PostgreSQL + PostGIS

The backend allows exactly this frontend CORS origin:

http://localhost:5173

Do not change the Vite development port.

Existing prototype files include:

index.html
package.json
package-lock.json
tsconfig.json
vite.config.ts
.env.example
README.md
src/App.tsx
src/data.ts
src/main.tsx
src/styles.css

src/data.ts contains hard-coded prototype data.

F0 must inspect the existing files and Git status.

Do not delete the prototype. Move it into src/legacy-prototype/ during the approved implementation phase, preserve its contents and stop importing it from production routes.

Do not upgrade major versions of existing dependencies without approval.

The user starts the backend. Do not start it independently.

Backend startup command for the user:

powershell
cd D:\landnexus-platform\landnexus-backend
.\mvnw.cmd spring-boot:run


The user's existing environment variables include DB_PASSWORD and JWT_SECRET.

For demo records, the user may run:

powershell
D:\landnexus-platform\scripts\proposal-workflow-demo.ps1


Never ask the user to paste passwords or tokens into chat.

4. Technology stack and coding standards

Use:

React 18
TypeScript with strict mode
Vite
Tailwind CSS
Redux Toolkit
React Router
Axios
Vitest
React Testing Library
@testing-library/user-event
jsdom
MSW
lucide-react

Use react-hook-form only if justified. Otherwise use controlled components.

Do not introduce:

Another global state library
A UI mega-kit
A date library
Unnecessary dependencies

Use native Intl APIs for dates and numbers.

Redux Toolkit is reserved for shared state:

Authentication session
Current user
Access token
Notification unread count
Toasts

Page data should remain in components or custom hooks.

TypeScript rules:

strict: true
No any
Use unknown and narrow types.
Define explicit types for API requests and responses.
Keep API payload types in src/api/types.ts.
5. Backend API contract

All API paths below are relative to:

http://localhost:8080/api/v1

IDs are UUID strings.

Dates use yyyy-MM-dd.

Timestamps use ISO-8601 UTC instants.

5.1 Common response structures
ts
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors: {
    field: string;
    message: string;
  }[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type RecordStatus = 'ACTIVE' | 'INACTIVE';


Pagination:

Default page: 0
Default size: 20
Maximum server size: 100
Supported frontend sizes: 10, 20, 50

The backend determines sorting.

5.2 Error handling
HTTP status	Frontend behaviour
400	Show validation errors or backend message
401	Refresh once; if unsuccessful, clear session and redirect
403	Show no-permission message
404	Show not-found message
409	Explain conflict and offer reload
413	Explain that the uploaded file is too large
500	Generic error without exposing server internals
Network error	Backend unreachable message and retry

Never expose stack traces, SQL messages or internal exception details.

5.3 Authentication

Endpoints:

Method	Endpoint	Purpose
POST	/auth/login	Login
POST	/auth/refresh	Refresh tokens
POST	/auth/logout	Logout
GET	/auth/me	Current user

Types:

ts
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
}


Login body:

ts
{
  username: string;
  password: string;
}


Login failures return:

Invalid username or password

Never reveal whether the account is locked.

There is no password-reset, self-registration or change-password API.

5.4 Roles and permissions

Available roles:

SUPER_ADMIN
CENTRAL_ADMIN
MINISTRY_ADMIN
STATE_ADMIN
DIVISION_ADMIN
DISTRICT_ADMIN
CONSULTANT
SCRUTINY_OFFICER
FIELD_OFFICER
COMPETENT_AUTHORITY
FINANCE_OFFICER
AUDITOR
CITIZEN

Existing permission codes include:

MASTER_DATA_READ
MASTER_DATA_WRITE
USER_READ
USER_WRITE
AUDIT_READ
PROPOSAL_CREATE
PROPOSAL_READ_OWN
PROPOSAL_READ
PROPOSAL_SCRUTINIZE
PROPOSAL_DECIDE

Additional module-specific permissions are defined in Sections 5.13 and 5.14.

Important: Never hard-code role-to-permission mappings in the frontend. Always use /auth/me.

5.5 Administration master data

Base:

/administration/{resource}

Resources:

ministries
departments
states
divisions
districts
talukas
villages

Operations:

Method	Endpoint
GET	/{resource}?page=&size=
GET	/{resource}/{id}
POST	/{resource}
PUT	/{resource}/{id}
POST	/{resource}/{id}/activate
POST	/{resource}/{id}/deactivate

Parent filters:

Departments: ministryId
Divisions: stateId
Districts: stateId
Talukas: districtId
Villages: talukaId

Base response:

ts
interface MasterBase {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}


Additional fields:

Department: ministryId, ministryName, level
Division: stateId, stateName
District: stateId, stateName, divisionId, divisionName
Taluka: districtId, districtName
Village: talukaId, talukaName

Rules:

Code maximum 30 characters.
Name maximum 150 characters.
Code is trimmed and upper-cased by the backend.
Duplicate code returns 409.
No delete endpoint exists.
Use activate/deactivate.

District access endpoint:

GET /administration/my-districts?page=&size=

Use this endpoint for every district selector in proposal forms and other scoped forms.

5.6 Users and geographic scope

Endpoints:

Method	Endpoint
GET	/administration/users
GET	/administration/users/{id}
POST	/administration/users
PUT	/administration/users/{id}/roles
POST	/administration/users/{id}/enable
POST	/administration/users/{id}/disable
GET	/administration/roles
GET	/administration/users/{id}/scopes
PUT	/administration/users/{id}/scopes

Types:

ts
interface UserCreateRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  roles: string[];
}

interface UserResponse {
  id: string;
  username: string;
  email: string;
  fullName: string;
  enabled: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleResponse {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

interface ScopeEntryResponse {
  id: string;
  type: 'STATE' | 'DIVISION' | 'DISTRICT';
  referenceId: string;
  referenceName: string;
}


Scope update replaces the complete scope list.

Each entry must contain exactly one of:

stateId
divisionId
districtId

Empty list clears all scopes.

Business rules remain backend-enforced.

A scoped user without an assigned scope has no access.

After creating a scoped user, offer geographic scope assignment.

5.7 Audit trail and login history

Permission: AUDIT_READ

Endpoints:

GET /administration/audit-events
GET /administration/login-history

Audit event:

ts
interface AuditEventResponse {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
}


Login history:

ts
interface LoginHistoryResponse {
  id: string;
  occurredAt: string;
  userId: string | null;
  usernameAttempted: string;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}


Both are read-only and append-only.

Never build edit/delete controls for these records.

IP addresses must appear only on the login-history screen.

5.8 Government proposals

Base:

/projects/proposals

Project types:

ts
export type ProjectType =
  | 'NATIONAL_HIGHWAY'
  | 'STATE_HIGHWAY'
  | 'DISTRICT_ROAD'
  | 'RURAL_ROAD'
  | 'EXPRESSWAY'
  | 'RAILWAY'
  | 'DAM'
  | 'IRRIGATION'
  | 'SCHOOL'
  | 'HOSPITAL'
  | 'GOVERNMENT_BUILDING'
  | 'OTHER_INFRASTRUCTURE';


Linear types require length in kilometres:

NATIONAL_HIGHWAY
STATE_HIGHWAY
DISTRICT_ROAD
RURAL_ROAD
EXPRESSWAY
RAILWAY

Statuses:

ts
export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'CLARIFICATION_REQUESTED'
  | 'RECOMMENDED'
  | 'APPROVED'
  | 'REJECTED';


Proposal request:

ts
export interface ProposalRequest {
  title: string;
  projectType: ProjectType;
  districtId: string;
  talukaId?: string | null;
  departmentId: string;
  lengthKm?: number | null;
  estimatedLandAreaHa: number;
  villageIds: string[];
  alignmentDescription?: string | null;
  description: string;
  plannedStartDate: string;
  plannedEndDate: string;
}


Proposal response:

ts
export interface ProposalResponse {
  id: string;
  proposalNumber: string | null;
  title: string;
  projectType: ProjectType;
  status: ProposalStatus;
  versionNo: number;
  stateId: string;
  districtId: string;
  talukaId: string | null;
  departmentId: string;
  lengthKm: number | null;
  estimatedLandAreaHa: number;
  villageIds: string[];
  alignmentDescription: string | null;
  description: string;
  plannedStartDate: string;
  plannedEndDate: string;
  ownerUserId: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectCode: string | null;
  availableActions: string[];
}


Limits:

Title: 200 characters
Alignment description: 1000 characters
Description: 2000 characters
Land area: positive, up to 10 digits + 2 decimals
Length: positive for linear types, up to 8 digits + 2 decimals
Villages: 1–500 active villages
End date must be after start date

Endpoints:

POST /projects/proposals
GET /projects/proposals
GET /projects/proposals/{id}
PUT /projects/proposals/{id}
GET /projects/proposals/{id}/history
GET /projects/proposals/{id}/versions
5.9 Proposal workflow actions

Workflow buttons must be driven exclusively by proposal.availableActions.

Action	Endpoint	Reason
SUBMIT	/submit	No
RESUBMIT	/resubmit	No
START_SCRUTINY	/start-scrutiny	No
REQUEST_CLARIFICATION	/clarification	Required
RECOMMEND	/recommend	Optional
REJECT_SCRUTINY	/reject	Required
APPROVE	/approve	Optional
REJECT	/reject	Required

Reason maximum: 1000 characters.

Workflow restrictions:

Nobody reviews their own proposal.
The recommending officer cannot approve or reject the same proposal.
Only the owner can submit or edit.
APPROVE creates a project.
409 means the action or state is no longer valid.

Do not duplicate workflow rules in the frontend.

5.10 Projects

Read-only.

Endpoints:

GET /projects
GET /projects/{id}

Projects are created only by approving proposals.

Never add project creation or edit controls.

5.11 Notifications

Endpoints:

GET /notifications
GET /notifications/unread-count
POST /notifications/{id}/read

Users see their own notifications only.

When entityType === 'Proposal', link to /proposals/{entityId}.

Refresh unread count every 60 seconds while the browser tab is visible and after workflow actions.

5.12 Health and unavailable backend capabilities

Health:

GET http://localhost:8080/actuator/health

Use only to diagnose backend connectivity.

Backend capabilities not currently available include:

Password reset or change
Self-registration
Dashboard/statistics endpoints
SLA reports
GIS maps and GIS integrations
Compensation calculations
Modules 5–7 functionality

Do not fabricate these capabilities.

6. Authentication and session security

This section is critical.

Create exactly one shared Axios instance:

src/api/client.ts

Base URL:

ts
import.meta.env.VITE_API_BASE_URL


Default:

http://localhost:8080/api/v1

Every API call must use the shared Axios client, except authentication login and refresh calls that must bypass the normal refresh interceptor.

Token storage
Access token: Redux memory only.
Refresh token: sessionStorage.
Never put either token in localStorage.

Reason: refresh tokens are single-use. Sharing a token between browser tabs can trigger backend theft detection and terminate all sessions.

Document the security trade-off and XSS exposure in:

docs/FRONTEND_ARCHITECTURE.md

Interceptors
Add bearer access token to requests.
Handle non-auth 401 responses.
Refresh only once.
Use a single-flight refresh promise.
All concurrent 401 responses wait for the same refresh.
Immediately save the new access and refresh tokens.
Retry the original request once.
Never retry indefinitely.
On refresh failure, clear session and redirect to login.
Show "Your session expired".

At app startup:

Read refresh token from sessionStorage.
Refresh token.
Call /auth/me.
Display full-page loading during initialization.

Logout:

Call /auth/logout.
Ignore logout network errors.
Clear Redux.
Clear sessionStorage.
Redirect to login.

Never decode JWT to determine permissions.

Multipart uploads

File uploads use FormData and you must NOT set the Content-Type header yourself (the browser adds the multipart boundary).

Use the shared Axios client for uploads.

Use responseType: 'blob' for authenticated downloads.

7. Authorization and route protection

Implement:

useAuth()
can(permission)
canAny(...permissions)
hasRole(role)
ProtectedRoute
RequirePermission

Protected routes redirect unauthenticated users to login and remember the intended destination.

After login, return users to the original URL.

Permission-denied routes show an in-app "No access" page.

Navigation and controls must use /auth/me permissions.

Backend authorization is always authoritative.

8. Screens and UI behaviour
8.1 Global behaviour

Every data screen must support:

Loading
Empty
Error
Content

Lists use server pagination.

Forms:

Match server validation limits.
Show errors under fields.
Map backend fieldErrors to fields.
Prevent double submissions.
Preserve user input after errors.

Mutations show success and error toasts.

Irreversible actions require confirmation.

Use en-IN for date formatting and 24-hour time.

Show area as hectares and length as kilometres.

UUIDs appear only in details or tooltips, with copy buttons.

8.2 Navigation and layout

Use a professional navy/blue enterprise design.

Responsive requirements:

Desktop
Tablet
Mobile
Collapsible sidebar drawer

Header:

Breadcrumb
Notification bell and unread badge
Full name
Roles
District count
Logout

Navigation:

Item	Route	Permission
My work	/	Always
Proposals	/proposals	PROPOSAL_READ or PROPOSAL_READ_OWN
New proposal	/proposals/new	PROPOSAL_CREATE
Projects	/projects	PROPOSAL_READ or PROPOSAL_READ_OWN
Notifications	/notifications	Always
Master data	/admin/master/...	MASTER_DATA_READ
Users	/admin/users	USER_READ
Roles	/admin/roles	USER_READ
Audit trail	/admin/audit	AUDIT_READ
Login history	/admin/logins	AUDIT_READ
Parcels	/land/parcels	LAND_RECORD_READ
Landowners	/land/landowners	LANDOWNER_READ
Acquisition cases	/acquisition	ACQUISITION_READ
My surveys	/acquisition/my-surveys	SURVEY_PERFORM
Roadmap	/roadmap/...	Always

Disabled or unavailable roadmap items must be visually distinguished from functioning modules.

8.3 Login and session screens

/login:

Username
Password
Show/hide password
Loading state
Generic login error

/forgot-password:

Show:

"Password reset is not available yet. Please contact your administrator."

Do not create a fake password-reset form.

8.4 Reference-name cache

Implement useReferenceNames().

Load:

All accessible districts
Departments
States

Load talukas and villages lazily.

Never block a main screen because a name lookup failed.

When names are unknown, show a shortened ID and tooltip.

Do not cache sensitive landowner personal data.

8.5 My work

There is no dashboard API.

Build My work from real proposal and notification endpoints.

Show role-appropriate work:

Consultant: drafts, submitted, clarification, approved.
Scrutiny officer: submitted and under-scrutiny.
Competent authority: recommended proposals.
Administrators: recent proposals and notifications.

Use totalElements for counts.

Clearly label the page as based on live API data.

Do not invent dashboard statistics.

8.6 Proposals list

Columns:

Proposal number
Title
Type
District
Status
Version
Submitted date
Updated date

Filters:

Status
District

Use server pagination.

8.7 Proposal create/edit

Routes:

/proposals/new
/proposals/:id/edit

Sections:

Basic information
Location
Project details
Timeline

District selector uses my-districts.

Taluka and village selectors load from the relevant parent.

Villages must be selectable in groups by taluka.

Changing district must clear village selections after confirmation.

Department must be active.

Show the hectare conversion helper:

1 hectare = 10,000 m²

Save draft through POST or PUT.

8.8 Proposal details

Route:

/proposals/:id

Sections:

Overview
Status timeline
History
Versions
Actions

Actions come from availableActions.

Required reason dialogs:

Request clarification
Reject scrutiny
Reject

Optional reason dialogs:

Recommend
Approve

After success, refresh the proposal and history.

After approval, show the generated project code.

On 409, reload and explain the conflict.

8.9 Projects

Routes:

/projects
/projects/:id

Read-only.

Show project code, title, type, district, status, approval date and originating proposal.

8.10 Notifications

Implement:

Header bell
Latest five notifications
Full notifications page
Unread-only filter
Mark as read
Proposal navigation

Refresh unread counts every 60 seconds while visible.

8.11 Administration
Master data

Build one configuration-driven CRUD system for all seven resources.

Do not duplicate seven independent screens.

Support:

Ministries
Departments
States
Divisions
Districts
Talukas
Villages

Use parent selectors and server validation.

Create/edit through modal or side panel.

Activate/deactivate only. No delete.

Users

Implement:

Paged list
Create user
Edit roles
Enable/disable
Scope editor

After creating a scoped user, ask whether to assign scope immediately.

Roles

Read-only role and permission table.

Audit

Filters:

Entity type
Entity ID
Actor

Expandable event details.

Login history

Filter by username.

Show success/failure, reason, IP and user agent.

Both screens are read-only.

8.12 Error pages

Implement:

No access
Page not found
Global error boundary
Backend unreachable banner

Offer retry where appropriate.

8.13 Roadmap placeholders

Only the following modules should appear as unavailable roadmap items:

Valuation and compensation
GIS map
Monitoring and MIS

Land Records and Acquisition must not appear as unavailable placeholders because their implementation is covered by Modules 3 and 4.

Every roadmap page must clearly say:

"This module is planned and not available yet."

Do not add fake tables, charts or numbers.

9. UI and UX standards

Design colours:

Token	Colour
Navy 900	#0B1F3A
Blue 600	#1D4ED8

Use neutral colours and semantic success, warning, danger and info colours.

Proposal status colours:

DRAFT: grey
SUBMITTED: blue
UNDER_SCRUTINY: indigo
CLARIFICATION_REQUESTED: amber
RECOMMENDED: teal
APPROVED: green
REJECTED: red

Always show status text alongside colour.

Build reusable components:

Button
IconButton
Input
Textarea
Select
MultiSelect
Checkbox
Badge
Card
Table
Modal
ConfirmDialog
Toast
Tabs
Skeleton
EmptyState
ErrorState
Spinner
Breadcrumbs
Tooltip
CopyButton

Accessibility:

Semantic HTML
Labels connected to inputs
Visible keyboard focus
Keyboard-operable dialogs
Focus trapping
Escape closes dialogs
aria-live for notifications and errors
Accessible table headers
WCAG AA contrast

Responsive verification widths:

360 px
768 px
1280 px

UI language: English.

Keep user-visible strings organized by feature for future Marathi translation.

10. Project folder structure

Use this structure:

text
src/
  api/
    client.ts
    types.ts
    errors.ts
    auth.ts
    proposals.ts
    projects.ts
    notifications.ts
    administration.ts
    landRecords.ts
    acquisition.ts

  app/
    store.ts
    router.tsx
    providers/

  features/
    auth/
    proposals/
    projects/
    notifications/
    admin/
      master/
      users/
      roles/
      audit/
    landRecords/
      parcels/
      landowners/
      documents/
    acquisition/
      cases/
      surveys/
      notices/
      objections/
      awards/
      possession/
    myWork/

  components/
    ui/

  hooks/
    useApiQuery.ts
    useApiMutation.ts
    useDebounce.ts
    usePagination.ts
    useReferenceNames.ts

  utils/
    format.ts
    permissions.ts
    strings.ts

  legacy-prototype/

docs/
  FRONTEND_BUILD_PROMPT.md
  FRONTEND_ARCHITECTURE.md


Do not put business logic in UI components when it belongs in hooks or utilities.

No duplicated API clients.

No fetch calls outside the shared API architecture.

Never use dangerouslySetInnerHTML.

11. Testing and verification

Use Vitest, React Testing Library and MSW.

Required tests:

API client attaches bearer token.
401 refresh and retry.
Two simultaneous 401 responses trigger only one refresh.
Failed refresh clears the session.
Login and refresh bypass interceptors.
ProtectedRoute redirects logged-out users.
RequirePermission shows No access.
Permission checks use /auth/me.
Proposal actions match availableActions.
Reason-required dialogs block empty submission.
Reject actions call /reject.
Proposal validation.
Linear project type requires length.
End date must follow start date.
Server field errors appear under correct fields.
Navigation respects permissions.
Generic master-data screen works from configuration.
Duplicate master data errors are displayed.
Error mapping supports API and network errors.
Landowner names are hidden without permission.
Multipart upload uses FormData without manually setting Content-Type.
File validation.
Verification button hidden for uploader.
Authenticated blob download.
Acquisition action buttons follow availableActions.
Survey verification permissions.
Photo upload and download.
GPS validation.
Objection and award form validation.

Add these package scripts:

json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}


Verification commands:

powershell
cd D:\landnexus-platform\LandNexus-frontend

npm install
npm run build
npm run test
npm run dev


Run npm run lint if the project already has a lint script.

After each phase, report actual command output.

Do not claim success without execution.

12. Implementation phases
F0 – Repository inspection and plan

<badge>Inspection only – no code changes</badge>

Inspect:

Git status
Node and npm versions
package.json
package-lock.json
TypeScript configuration
Vite configuration
Environment configuration
Existing React components
CSS
Existing demo data
Existing scripts
Existing dependencies

Commands:

powershell
cd D:\landnexus-platform\LandNexus-frontend

git status

node --version
npm --version

Get-Content package.json
Get-Content tsconfig.json
Get-Content vite.config.ts
Get-Content .env.example

Get-ChildItem src -Recurse


Report:

Existing architecture.
Dependency versions.
Existing scripts.
Prototype functionality.
What will be preserved.
What will move to legacy-prototype.
Proposed folder structure.
Dependencies to add and why.
Security and migration risks.
Proposed implementation order.

Do not edit any file.

Completion: User approves the plan.

STOP and wait.

F1 – Foundation and authentication

Implement:

Tooling
Tailwind
Redux Toolkit
React Router
Axios
Vitest
MSW
Environment handling
Design tokens
UI component basics
Axios client
Single-flight refresh
Auth slice
useAuth
ProtectedRoute
RequirePermission
Login
Forgot-password information page
Sidebar
Header
Breadcrumbs
User menu
403 and 404 pages
Error boundary
My work skeleton

Preserve the old prototype in legacy-prototype.

Completion criteria:

Real backend login works.
Reload maintains session.
Access token refresh works.
Logout works.
Permission-driven menu works.
Build passes.
Tests pass.

Report exact outputs.

STOP and wait for confirmation.

F2 – Government proposals

Implement:

Proposal API types
API module
Reference-name cache
Proposal list
Create proposal
Edit proposal
District → Taluka → Village selector
Proposal details
Status timeline
History
Versions
Action bar
Reason dialogs

Completion criteria:

The consultant, scrutiny officer and competent authority workflow works against the real backend.

Verify 403 and 409 handling.

Run tests for proposal forms and workflow actions.

STOP and wait for confirmation.

F3 – Projects and notifications

Implement:

Projects list
Project details
Notification bell
Notification dropdown
Notifications page
Unread counts
My work using actual endpoints

Completion criteria:

Approved proposal creates visible project.
Unread counts update.
Notifications are user-specific.
All lists are paginated.
Build and tests pass.

STOP and wait.

F4 – Administration

Implement:

Generic master-data CRUD
Seven master-data resource configurations
User management
Role management
Scope editor
Audit trail
Login history

Completion criteria:

An administrator can create master data, create a consultant, assign geographic scope and inspect audit events.

Read-only users must not see write controls.

Build and tests must pass.

STOP and wait.

F5 – Polish, testing and documentation

Implement:

Responsive design
Accessibility improvements
Complete loading states
Empty states
Error states
Roadmap pages
Remaining tests
Architecture documentation
README updates

Create:

docs/FRONTEND_ARCHITECTURE.md

Document:

Overall architecture
API client
Token storage trade-off
Single-flight refresh
Authorization
Adding new screens
Testing

Update README with:

Installation
Backend requirements
Environment
Development
Testing
Build
Folder structure

Completion criteria:

Build green.
Tests green.
No any.
No console noise.
No production demo data.
Documentation complete.

STOP and wait for confirmation before F6.

5.13 Land Records API – Module 3

Base:

/land-records

Permissions
LAND_RECORD_READ
LAND_RECORD_WRITE
LANDOWNER_READ
DOCUMENT_READ
DOCUMENT_UPLOAD
DOCUMENT_VERIFY

Role behaviour:

Role	Access
FIELD_OFFICER	Read/write land records and upload documents
SCRUTINY_OFFICER	Read/write land records, upload and verify documents
COMPETENT_AUTHORITY	Read parcels, owners and documents
Administrators	Read parcels and shares only
FINANCE_OFFICER	Read parcels and shares only
AUDITOR	Read parcels and shares only

Administrators, finance officers and auditors must not see owner names or documents.

Always use /auth/me permissions.

A record outside geographic scope returns 404, not 403.

Types
ts
export type LandClassification =
  | 'AGRICULTURAL_IRRIGATED'
  | 'AGRICULTURAL_DRY'
  | 'NON_AGRICULTURAL'
  | 'FOREST'
  | 'GOVERNMENT'
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INDUSTRIAL'
  | 'WASTE_LAND'
  | 'OTHER';

export type LandUse =
  | 'CULTIVATION'
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INDUSTRIAL'
  | 'ROAD'
  | 'WATER_BODY'
  | 'VACANT'
  | 'OTHER';

export interface ParcelRequest {
  villageId: string;
  gatNumber?: string | null;
  surveyNumber?: string | null;
  subdivisionNumber?: string | null;
  areaHa: number;
  classification: LandClassification;
  landUse: LandUse;
}

export interface ParcelResponse {
  id: string;
  stateId: string;
  districtId: string;
  talukaId: string;
  villageId: string;
  gatNumber: string | null;
  surveyNumber: string | null;
  subdivisionNumber: string | null;
  areaHa: number;
  classification: LandClassification;
  landUse: LandUse;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export type OwnerType =
  | 'INDIVIDUAL'
  | 'GOVERNMENT'
  | 'INSTITUTION';

export interface LandownerRequest {
  districtId: string;
  ownerType: OwnerType;
  fullName: string;
  guardianName?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface LandownerSummary {
  id: string;
  districtId: string;
  ownerType: OwnerType;
  fullName: string;
}

export interface LandownerResponse extends LandownerSummary {
  guardianName: string | null;
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OwnershipBasis =
  | 'ORIGINAL'
  | 'INHERITANCE'
  | 'SALE'
  | 'GIFT'
  | 'PARTITION'
  | 'COURT_ORDER'
  | 'OTHER';

export interface OwnershipRequest {
  landownerId: string;
  sharePercent: number;
  basis: OwnershipBasis;
  fromDate: string;
  remarks?: string | null;
}

export interface OwnershipResponse {
  id: string;
  parcelId: string;
  landownerId: string;
  ownerName: string | null;
  ownerType: OwnerType | null;
  sharePercent: number;
  basis: OwnershipBasis;
  fromDate: string;
  toDate: string | null;
  current: boolean;
  remarks: string | null;
}

export type MutationType =
  | 'SALE'
  | 'INHERITANCE'
  | 'GIFT'
  | 'PARTITION'
  | 'MORTGAGE'
  | 'COURT_ORDER'
  | 'OTHER';

export interface MutationRequest {
  mutationNumber: string;
  mutationDate: string;
  mutationType: MutationType;
  description?: string | null;
}

export interface MutationResponse extends MutationRequest {
  id: string;
  parcelId: string;
  createdBy: string | null;
  createdAt: string;
}

export type RevenueRecordType =
  | 'SEVEN_TWELVE'
  | 'EIGHT_A';

export interface RevenueRecordRequest {
  recordType: RevenueRecordType;
  extractDate: string;
  khataNumber?: string | null;
  particulars: string;
}

export interface RevenueRecordResponse
  extends RevenueRecordRequest {
  id: string;
  parcelId: string;
  createdBy: string | null;
  createdAt: string;
}

export type DocumentCategory =
  | 'SEVEN_TWELVE_EXTRACT'
  | 'EIGHT_A_EXTRACT'
  | 'MUTATION_ENTRY'
  | 'SALE_DEED'
  | 'SURVEY_MAP'
  | 'NOTICE'
  | 'OTHER';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED';

export interface DocumentVersion {
  versionNo: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedByUsername: string;
  uploadedAt: string;
}

export interface DocumentResponse {
  id: string;
  parcelId: string;
  category: DocumentCategory;
  title: string;
  currentVersionNo: number;
  verificationStatus: VerificationStatus;
  verifiedVersionNo: number | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  verificationRemarks: string | null;
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersion[];
}

API endpoints
Method	Endpoint	Permission
GET	/parcels	LAND_RECORD_READ
POST	/parcels	LAND_RECORD_WRITE
PUT	/parcels/{id}	LAND_RECORD_WRITE
POST	/parcels/{id}/activate	LAND_RECORD_WRITE
POST	/parcels/{id}/deactivate	LAND_RECORD_WRITE
GET	/landowners	LANDOWNER_READ
POST	/landowners	LAND_RECORD_WRITE
GET	/landowners/{id}	LANDOWNER_READ
PUT	/landowners/{id}	LAND_RECORD_WRITE
GET	/parcels/{id}/ownerships	LAND_RECORD_READ
POST	/parcels/{id}/ownerships	LAND_RECORD_WRITE
POST	/parcels/{id}/ownerships/{ownershipId}/end	LAND_RECORD_WRITE
GET	/parcels/{id}/mutations	LAND_RECORD_READ
POST	/parcels/{id}/mutations	LAND_RECORD_WRITE
GET	/parcels/{id}/revenue-records	LAND_RECORD_READ
POST	/parcels/{id}/revenue-records	LAND_RECORD_WRITE
GET	/parcels/{id}/documents	DOCUMENT_READ
GET	/documents/{id}	DOCUMENT_READ
POST	/parcels/{id}/documents	DOCUMENT_UPLOAD
POST	/documents/{id}/versions	DOCUMENT_UPLOAD
GET	/documents/{id}/versions/{n}/download	DOCUMENT_READ
POST	/documents/{id}/verify	DOCUMENT_VERIFY
POST	/documents/{id}/reject	DOCUMENT_VERIFY
Important backend rules
At least one of Gat number or Survey number is required.
Parcel area must be positive, maximum four decimals.
Duplicate parcel identifiers return 409.
Village cannot change on parcel update.
Inactive parcels cannot be changed.
Ownership shares must total at most 100%.
Same owner cannot be added twice.
Owner must belong to parcel district.
Ownership end date cannot be applied twice.
8A requires khata number.
Mutation and revenue records are never edited.
Duplicate mutation number or record type/date returns 409.
Landowner views are audited.
Landowner district cannot change.
Upload errors may return 400 or 413.
Document upload rules

Allowed formats:

PDF
JPEG
PNG

Maximum file size: 10 MB.

The backend validates actual file content, not merely the extension.

Reject empty files.

Multipart fields:

file
category
title

New versions reset verification to PENDING.

Reject verification by the current uploader.

8.14 Land Records screens
Navigation
Parcels: /land/parcels
Landowners: /land/landowners
Parcels list

Filters:

District
Village
Gat/Survey number

Columns:

Gat
Survey
Subdivision
Village
Area
Classification
Status

New parcel button requires LAND_RECORD_WRITE.

Parcel form

Village selection:

District → Taluka → Village.

Fields:

Gat number
Survey number
Subdivision
Area in hectares
Classification
Land use

At least one of Gat/Survey is mandatory.

Village is read-only during editing.

Parcel details

Tabs:

Overview
Owners
Mutations
7/12 and 8A
Documents
Owners

Show:

Owner name when permitted
Share percentage
Ownership basis
Dates
Current ownership
Total share

When ownerName is null, display:

"Hidden (no permission to see owner details)"

Never show an empty owner cell.

Validate remaining ownership share client-side and show backend validation errors.

Mutations

List and add forms.

No edit/delete controls.

Revenue records

Support:

7/12 extract
8A extract

Require khata number for 8A.

Documents

Visible only with DOCUMENT_READ.

Show:

Category
Title
Current version
Verification status
Uploader
File size
SHA-256
Upload

Use FormData.

Check extension and maximum 10 MB client-side.

Do not set multipart Content-Type manually.

Show upload progress and backend errors.

Download

Use shared Axios client:

responseType: 'blob'
URL.createObjectURL
Temporary anchor
URL.revokeObjectURL

Download only.

Never embed uploaded files in an iframe or open them inline.

Verification

Permission: DOCUMENT_VERIFY.

Verify supports optional remarks.

Reject requires remarks.

Hide verification actions when the current user uploaded the current version.

Explain that a new version resets verification.

Landowners page

Show banner:

"Personal data: every view is recorded in the audit trail."

List names only.

Details reveal address and phone on demand.

Never save landowner personal data in localStorage or persistent browser storage.

Clear landowner data from memory on logout.

Never display or invent Aadhaar or government ID numbers.

Synthetic test data must be labelled DEMO.

Phase F6 – Land Records implementation

Implement:

Land record types.
API module.
Parcel list.
Parcel create/edit.
Parcel details.
Ownership management.
Mutations.
7/12 and 8A records.
Landowners.
Document upload.
Document versioning.
Authenticated blob download.
Document verification.
Permissions and masking.
Tests.

Completion criteria:

Field officer can create parcel.
Field officer can add ownership.
Field officer can upload PDF.
Finance officer sees shares but not owner names.
Finance officer cannot access documents.
Scrutiny officer can verify documents.
Uploader cannot verify their own current version.
Downloaded file matches uploaded file.
All required tests pass.
Build and tests pass.

Run verification and report exact outputs.

STOP and wait for confirmation before F7.

5.14 Acquisition API – Module 4

Base:

/acquisition

Permissions
ACQUISITION_READ
ACQUISITION_MANAGE
ACQUISITION_DECIDE
SURVEY_PERFORM
SURVEY_VERIFY

Roles:

Role	Capability
SCRUTINY_OFFICER	Manage acquisition and verify surveys
COMPETENT_AUTHORITY	Legal decisions
FIELD_OFFICER	Perform assigned surveys

Cases outside user scope return 404.

All case workflow buttons must be driven by availableActions.

Types
ts
export type CaseStatus =
  | 'INITIATED'
  | 'SURVEY_IN_PROGRESS'
  | 'VERIFICATION_COMPLETE'
  | 'NOTIFICATION_ISSUED'
  | 'READY_FOR_AWARD'
  | 'AWARD_DECLARED'
  | 'POSSESSION_TAKEN'
  | 'CLOSED'
  | 'CANCELLED';

export type Framework =
  | 'LARR_2013'
  | 'NATIONAL_HIGHWAYS_ACT_1956'
  | 'RAILWAYS_ACT_1989'
  | 'STATE_ACT'
  | 'OTHER';

export interface CaseRequest {
  projectId: string;
  framework: Framework;
  frameworkNote?: string | null;
  description?: string | null;
}

export interface CaseResponse {
  id: string;
  caseNumber: string;
  projectId: string;
  stateId: string;
  districtId: string;
  framework: Framework;
  frameworkNote: string | null;
  description: string | null;
  status: CaseStatus;
  villageIds: string[];
  createdAt: string;
  updatedAt: string;
  availableActions: string[];
}

export interface CaseParcel {
  id: string;
  caseId: string;
  parcelId: string;
  villageId: string;
  areaToAcquireHa: number;
  assignedSurveyorUserId: string | null;
  surveyStatus: 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | null;
  owners: {
    landownerId: string;
    sharePercent: number;
  }[];
  identifiedAt: string;
}

export interface SurveyRequest {
  surveyedOn: string;
  measuredAreaHa: number;
  gpsLatitude: number;
  gpsLongitude: number;
  fieldNotes?: string | null;
}

export interface SurveyResponse {
  id: string;
  caseId: string;
  caseParcelId: string;
  surveyorUsername: string;
  surveyedOn: string;
  measuredAreaHa: number;
  recordedAreaHa: number;
  variancePercent: number;
  gpsLatitude: number;
  gpsLongitude: number;
  fieldNotes: string | null;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  verificationRemarks: string | null;
  createdAt: string;
}

export type NoticeType =
  | 'PRELIMINARY_NOTIFICATION'
  | 'FINAL_DECLARATION'
  | 'AWARD_NOTICE'
  | 'POSSESSION_NOTICE'
  | 'OTHER';

export interface NoticeRequest {
  noticeType: NoticeType;
  referenceNumber: string;
  issuedOn: string;
  objectionDeadline?: string | null;
  description?: string | null;
}

export interface ObjectionRequest {
  caseParcelId: string;
  receivedOn: string;
  grounds: string;
  objectorReference?: string | null;
}

export interface ObjectionResponse {
  id: string;
  caseId: string;
  caseParcelId: string;
  objectionNumber: string;
  receivedOn: string;
  grounds: string;
  objectorReference: string | null;
  status: 'OPEN' | 'ACCEPTED' | 'DISMISSED';
  registeredByUserId: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
}

export interface DeclareAwardRequest {
  awardNumber: string;
  awardDate: string;
  remarks?: string | null;
}

export interface AwardResponse {
  id: string;
  caseId: string;
  awardNumber: string;
  awardDate: string;
  remarks: string | null;
  declaredByUserId: string;
  lines: {
    caseParcelId: string;
    parcelId: string;
    awardedAreaHa: number;
  }[];
}

export interface PossessionRequest {
  caseParcelId: string;
  possessionDate: string;
  possessionType: 'PHYSICAL' | 'DEEMED';
  remarks?: string | null;
}

export interface PhotoResponse {
  id: string;
  surveyId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  gpsLatitude: number;
  gpsLongitude: number;
  capturedAt: string | null;
  uploadedByUsername: string;
  uploadedAt: string;
}

Acquisition API endpoints
Method	Endpoint	Permission
POST	/cases	ACQUISITION_MANAGE
GET	/cases	ACQUISITION_READ
GET	/cases/{id}	ACQUISITION_READ
GET	/cases/{id}/history	ACQUISITION_READ
PUT	/cases/{id}/villages	ACQUISITION_MANAGE
GET	/cases/{id}/parcels	ACQUISITION_READ
POST	/cases/{id}/parcels	ACQUISITION_MANAGE
DELETE	/cases/{id}/parcels/{caseParcelId}	ACQUISITION_MANAGE
POST	/cases/{id}/parcels/{caseParcelId}/assign	ACQUISITION_MANAGE
GET	/my-assignments	SURVEY_PERFORM
GET	/cases/{id}/surveys	ACQUISITION_READ
POST	/cases/{id}/parcels/{caseParcelId}/surveys	SURVEY_PERFORM
POST	/cases/{id}/surveys/{surveyId}/verify	SURVEY_VERIFY
POST	/cases/{id}/surveys/{surveyId}/reject	SURVEY_VERIFY
GET	/cases/{id}/verification-report	ACQUISITION_READ
POST	/cases/{id}/surveys/{surveyId}/photos	SURVEY_PERFORM
GET	/cases/{id}/surveys/{surveyId}/photos	ACQUISITION_READ
GET	/cases/{id}/surveys/{surveyId}/photos/{photoId}/download	ACQUISITION_READ
GET	/cases/{id}/notices	ACQUISITION_READ
POST	/cases/{id}/notices	ACQUISITION_MANAGE
GET	/cases/{id}/objections	ACQUISITION_READ
POST	/cases/{id}/objections	ACQUISITION_MANAGE
POST	/cases/{id}/objections/{objectionId}/decide	ACQUISITION_DECIDE
GET	/cases/{id}/award	ACQUISITION_READ
POST	/cases/{id}/award	ACQUISITION_DECIDE
GET	/cases/{id}/possessions	ACQUISITION_READ
POST	/cases/{id}/possessions	ACQUISITION_MANAGE

Stage endpoints:

POST /cases/{id}/start-survey
POST /cases/{id}/complete-verification
POST /cases/{id}/close-objection-window
POST /cases/{id}/complete-possession
POST /cases/{id}/issue-notification
POST /cases/{id}/close
POST /cases/{id}/cancel
Acquisition workflow actions

Drive buttons exclusively from availableActions.

Action	Purpose
START_SURVEY	Start surveying
COMPLETE_VERIFICATION	Complete survey verification
ISSUE_NOTIFICATION	Issue notification
CLOSE_OBJECTION_WINDOW	Close objection period
DECLARE_AWARD	Open award form
COMPLETE_POSSESSION	Complete possession
CLOSE	Close case
CANCEL	Cancel case

Cancellation requires a reason.

Closing can include an optional reason.

Backend-enforced stage rules

Show backend error messages when:

No parcels exist before survey starts.
Every parcel does not have a verified survey.
Notification does not contain an objection deadline.
Objection deadline has not passed.
Open objections remain.
Award date precedes the objection deadline.
Possession records are missing.

A parcel can belong to only one open acquisition case.

An assigned surveyor must be an enabled FIELD_OFFICER with access.

Survey GPS must be within India.

Survey notes are required if measured area differs by more than 10%.

An objection can be registered only while the notification is active and the objection period remains open.

Only an authorized different user can decide an objection.

Award cannot be cancelled after declaration.

There is no compensation amount yet. Compensation belongs to Module 5. Never invent one.

8.15 Acquisition screens
Navigation
Acquisition cases: /acquisition
My surveys: /acquisition/my-surveys
Cases list

Filters:

Status
District
Project

New case requires ACQUISITION_MANAGE.

New case form:

Approved project
Legal framework
Framework note
Description

Explain that applicable laws can differ by state.

Case details

Show:

Case number
Project
District
Framework
Status
Stage tracker
Available workflow actions

Tabs:

Villages and parcels
Surveys
Verification report
Notices
Objections
Award
Possession
History
Villages and parcels

Support:

Village selection
Parcel identification
Area-to-acquire validation
Recorded-area comparison
Owner count from snapshot
Surveyor assignment

Do not expose owner names through the acquisition snapshot, which contains IDs and shares only.

Surveys

Show:

Surveyor
Survey date
Measured area
Recorded area
Variance percentage
GPS
Notes
Status

Verify/reject controls must follow permissions and backend restrictions.

Verification report

Show recorded versus measured area, variance and GPS.

Notices

Support listing and adding notices.

Objections

Support registration and decision.

When objectorReference is null, show "Hidden".

Award

Show:

Award number
Award date
Remarks
Awarded area per parcel

Display:

"Compensation: Module 5 – not yet available."

Do not invent money values.

Possession

Support recording possession:

Case parcel
Possession date
PHYSICAL or DEEMED
Remarks
My surveys

Show the authenticated field officer's worklist from /my-assignments.

Survey form:

Survey date
Measured area
GPS latitude
GPS longitude
Field notes

Use a map-free GPS entry.

Provide "Use my location" using browser Geolocation API only after the user explicitly confirms.

Do not store GPS elsewhere.

Show variance and a warning when it exceeds 10%.

Survey photos

Upload JPEG/PNG photos with GPS coordinates and optional capturedAt.

Show photo list, GPS point, filename and SHA-256.

Do not embed server images inline.

Download through authenticated blob requests.

Use FormData without manually setting Content-Type.

Follow the server's photo count and file validation rules.

Honest limitations
No map yet: GIS is Module 6.
No compensation amount: Module 5.
No fabricated legal outcomes.
No invented survey information.
Phase F7 – Acquisition implementation

Implement:

Acquisition TypeScript types.
Acquisition API module.
Case list.
Case creation.
Case details.
Village and parcel management.
Surveyor assignment.
My surveys worklist.
Survey form.
GPS entry and optional geolocation.
Photo upload.
Photo download.
Survey verification.
Notices.
Objections.
Award.
Possession.
Case history.
Workflow action bar.
Permissions.
Validation.
Automated tests.

Before F7 starts:

The user must confirm that Module 4 backend APIs are available and operational.

Do not invent endpoints or change the supplied API contract without asking.

Completion criteria:

Scrutiny officer can create an acquisition case.
Field officer receives survey assignment.
Field officer submits survey with photo.
Scrutiny officer verifies the survey.
Competent authority declares award.
Possession can be recorded.
Case can be closed.
All buttons follow availableActions.
Permission restrictions work.
Build passes.
Tests pass.

Run verification and report exact outputs.

STOP and wait for confirmation.

13. Final security and quality checklist

Report each item as YES, NO or PARTIAL, with evidence.

All production data comes from the backend API.
No hard-coded business data outside legacy prototype and tests.
Access token remains in memory.
Refresh token remains in sessionStorage.
Refresh is single-flight.
No tokens in logs.
Navigation follows /auth/me.
Workflow actions follow availableActions.
All lists use server pagination.
Every data screen has loading, empty and error states.
Forms mirror backend validation limits.
Backend fieldErrors map correctly.
Mutations prevent double submission.
HTTP 400, 401, 403, 404, 409, 413, 500 and network errors are handled.
Audit trail and login history have no editing.
Projects and roles are read-only.
No fake password reset.
No fake dashboard statistics.
No fake file upload or GIS features outside supported APIs.
Landowner names are permission-masked.
Sensitive landowner data is not persisted locally.
Uploads use FormData correctly.
Downloads use authenticated blob requests.
Document verification follows backend rules.
Acquisition buttons use availableActions.
GPS is not stored outside the intended form/API flow.
No fabricated compensation amounts.
No AI, OCR, ML or unsupported integrations.
npm run build actual output is reported.
npm run test actual output is reported.
README is complete.
Architecture documentation is complete.
Absolutely prohibited actions
Do not push to Git.
Do not delete user source files.
Do not reset Git.
Do not rewrite history.
Do not commit .env.
Do not expose credentials.
Do not fabricate API responses.
Do not invent endpoints.
Do not invent government ID numbers.
Do not create fake production data.
Do not add unsupported modules.
Do not skip verification.
Do not proceed without user approval.
14. OpenCode execution instructions

Read this document completely before starting.

Also read:

docs/REQUIREMENTS_TRACEABILITY.md

if that file exists.

Start with F0 only.

For every phase:

Check Git status.
Inspect relevant files.
Explain the implementation plan.
Make only the approved phase changes.
Run the required commands.
Report exact outputs.
Report implemented, tested, partially implemented and blocked features.
Explain in simple Marathi.
Suggest a Git commit.
Stop and wait for the user's explicit approval.

Do not automatically continue to the next phase.

The user's approval is mandatory after every phase.

## 5.15 Valuation, compensation, payments and R&R API (Module 5), base `/compensation`
Permissions: `VALUATION_READ`, `VALUATION_MANAGE` (scrutiny officer), `VALUATION_APPROVE` (competent authority), `RULESET_MANAGE` and `RULESET_APPROVE` (SUPER_ADMIN, CENTRAL_ADMIN), `RATE_MANAGE` (admins, state and district admin),
`RATE_APPROVE` (SUPER_ADMIN, CENTRAL_ADMIN, STATE_ADMIN), `PAYMENT_READ`, `PAYMENT_RELEASE` (finance officer), `RR_READ`, `RR_MANAGE` (scrutiny and field officer), `RR_APPROVE` (competent authority), `RR_CATALOGUE` (SUPER_ADMIN, CENTRAL_ADMIN).
Always use `/auth/me` permissions. Cases outside the user's scope return 404. **Maker-checker everywhere:** the person who entered a rate, drafted a rule set, prepared an estimate or identified an R&R case cannot approve it (server returns 403).
**No law and no amount is built into the system.** Amounts come only from approved rate cards and approved rule sets. **Payments are ALWAYS SIMULATED. Never ask for or show bank account details, never write "paid", always write "simulated".**

```ts
export type RateStatus = 'PENDING'|'APPROVED'|'REJECTED';
export interface RateRequest { villageId: string; classification: string; ratePerHa: number; effectiveFrom: string; sourceNote?: string|null; } // classification = a LandClassification from 5.13
export interface RateResponse { id: string; villageId: string; districtId: string; classification: string; ratePerHa: number; effectiveFrom: string; sourceNote: string|null; status: RateStatus; createdByUserId: string; approvedByUserId: string|null; decidedAt: string|null; decisionRemarks: string|null; }
export type ComponentType = 'LAND_VALUE'|'ASSET_VALUE'|'PERCENT_OF'|'FIXED_PER_HECTARE';
export interface ComponentRequest { code: string; name: string; type: ComponentType; factor?: number|null; baseCodes?: string[]|null; } // code: ^[A-Z][A-Z0-9_]{1,39}$
export interface RuleSetRequest { name: string; framework: string; stateId?: string|null; districtId?: string|null; effectiveFrom: string; effectiveTo?: string|null; description?: string|null; components: ComponentRequest[]; } // framework: a Framework from 5.14
export interface RuleSetResponse { id: string; name: string; version: number; framework: string; stateId: string|null; districtId: string|null; effectiveFrom: string; effectiveTo: string|null; description: string|null;
  status: 'DRAFT'|'APPROVED'|'RETIRED'; createdByUserId: string; approvedByUserId: string|null; approvedAt: string|null; retireReason: string|null;
  components: { position: number; code: string; name: string; type: ComponentType; factor: number; baseCodes: string[] }[]; }
export interface AssetRequest { category: 'BUILDING'|'TREE'|'WELL'|'CROP'|'OTHER'; description: string; quantity: number; unit: string; unitValue: number; }
export interface AssetResponse { id: string; caseParcelId: string; category: string; description: string; quantity: number; unit: string; unitValue: number; value: number; voided: boolean; voidReason: string|null; }
export interface ValuationResponse { id: string; caseId: string; caseParcelId: string; parcelId: string; versionNo: number; awardedAreaHa: number; classification: string; ratePerHa: number; ruleSetName: string; ruleSetVersion: number;
  referenceDate: string; assetTotal: number; totalAmount: number; status: 'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'SUPERSEDED'; preparedByUsername: string; decidedByUserId: string|null; decidedAt: string|null; decisionRemarks: string|null; createdAt: string;
  lines: { position: number; code: string; name: string; type: ComponentType; basis: string; amount: number }[]; availableActions: ('SUBMIT'|'RECALCULATE'|'APPROVE'|'REJECT')[]; }
export interface CompensationSummary { caseId: string; caseNumber: string; parcels: number; approved: number; submitted: number; draft: number; notEstimated: number; approvedTotal: number;
  rows: { caseParcelId: string; parcelId: string; awardedAreaHa: number; estimateStatus: 'NOT_ESTIMATED'|'DRAFT'|'SUBMITTED'|'APPROVED'; valuationId: string|null; totalAmount: number|null }[]; }
export type PaymentStatus = 'INSTRUCTED'|'SENT'|'CONFIRMED'|'FAILED';
export interface PaymentResponse { id: string; valuationId: string; caseId: string; caseParcelId: string; landownerId: string; sharePercent: number; amount: number; status: PaymentStatus; mode: 'SIMULATED';
  reference: string|null; failureReason: string|null; attemptCount: number; releasedAt: string|null; confirmedAt: string|null; availableActions: ('RELEASE'|'RETRY'|'SIMULATE_CONFIRMED'|'SIMULATE_FAILED')[]; } // beneficiary = landownerId only, no name, no bank data
export interface PaymentSummary { caseId: string; mode: 'SIMULATED'; payments: number; totalAmount: number; instructedAmount: number; sentAmount: number; confirmedAmount: number; failedAmount: number; }
export interface BenefitTypeResponse { id: string; code: string; name: string; kind: 'ONE_TIME_CASH'|'MONTHLY_ALLOWANCE'|'HOUSING'|'EMPLOYMENT'|'OTHER'; defaultAmount: number|null; defaultMonths: number|null; requiresDisplaced: boolean; requiresLivelihoodLost: boolean; active: boolean; }
export interface RrCaseResponse { id: string; caseId: string; landownerId: string; displaced: boolean; livelihoodLost: boolean; status: 'IDENTIFIED'|'ASSESSED'|'APPROVED'|'COMPLETED'; notes: string|null; createdByUserId: string; approvedByUserId: string|null; decidedAt: string|null;
  entitlements: { id: string; benefitCode: string; benefitName: string; kind: string; amount: number|null; months: number|null; status: 'PLANNED'|'DELIVERED'; deliveredOn: string|null; deliveryRemarks: string|null }[];
  availableActions: ('ADD_ENTITLEMENT'|'APPROVE'|'DELIVER'|'COMPLETE')[]; }
```

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET, POST | `/rates?villageId=&status=`, `/rates` | `VALUATION_READ`, `RATE_MANAGE` | 409 duplicate village+classification+date |
| POST | `/rates/{id}/approve`, `/reject` | `RATE_APPROVE` | body `{ remarks }` (required to reject); not the maker |
| GET, POST | `/rule-sets?status=`, `/rule-sets` | `VALUATION_READ`, `RULESET_MANAGE` | 400 for an invalid component list |
| GET | `/rule-sets/{id}` | read | |
| POST | `/rule-sets/{id}/approve`, `/retire` | `RULESET_APPROVE`, `RULESET_MANAGE` | retire body `{ remarks }` required; 409 if it overlaps another approved set for the same place |
| GET, POST | `/cases/{caseId}/parcels/{caseParcelId}/assets` | read, `VALUATION_MANAGE` | not after the estimate is submitted (409) |
| POST | `/cases/{caseId}/assets/{assetId}/void` | `VALUATION_MANAGE` | body `{ reason }` |
| POST | `/cases/{caseId}/parcels/{caseParcelId}/valuations` | `VALUATION_MANAGE` | computes or recomputes a draft; 400 with the reason if no approved rate or rule set applies; only after the award is declared |
| GET | `/cases/{caseId}/valuations`, `/valuations/{id}`, `/cases/{caseId}/compensation-summary` | read | |
| POST | `/valuations/{id}/submit` | manage | |
| POST | `/valuations/{id}/approve`, `/reject` | `VALUATION_APPROVE` | body `{ remarks }`; not the preparer |
| POST | `/valuations/{id}/payments` | `PAYMENT_RELEASE` | one payment per owner, split by the ownership snapshot; once per estimate (409) |
| GET | `/cases/{caseId}/payments`, `/cases/{caseId}/payment-summary`, `/payments/{id}/events` | `PAYMENT_READ` | |
| POST | `/payments/{id}/release`, `/simulate-response` | `PAYMENT_RELEASE` | release also retries a failed one; simulate body `{ outcome: 'CONFIRMED'|'FAILED', reason? }` (reason required for FAILED) |
| GET, POST | `/rr/benefit-types` | `RR_READ`, `RR_CATALOGUE` | |
| GET, POST | `/cases/{caseId}/rr-cases` | `RR_READ`, `RR_MANAGE` | body `{ landownerId, displaced, livelihoodLost, notes? }`; the landowner must be an owner in the case |
| GET | `/rr-cases/{id}` | read | |
| POST | `/rr-cases/{id}/entitlements` | manage | body `{ benefitTypeId, amount?, months? }`; 400 if the family does not meet the benefit's conditions |
| POST | `/rr-cases/{id}/approve`, `/complete` | `RR_APPROVE`, manage | approve: not the identifier; complete: all benefits delivered |
| POST | `/rr-cases/{id}/entitlements/{entitlementId}/deliver` | manage | body `{ deliveredOn, remarks? }`, date not in the future |

## 8.16 Valuation, compensation and R&R screens
Menu (permission): **Rate cards and rule sets** `/compensation/rules` (`VALUATION_READ`), and tabs inside the acquisition case details (5.14): **Valuation**, **Payments** (`PAYMENT_READ`), **R&R** (`RR_READ`).
- **Rate cards**: table with status badges (PENDING grey, APPROVED green, REJECTED red); "New rate" (`RATE_MANAGE`): village chooser, classification select, rate per hectare, effective date, source note. Approve/reject dialog (hide for the maker).
- **Rule sets**: list with name, version, framework, place (district, state or nationwide), validity and status. A **component builder**: ordered rows with code, name, type, factor and, for PERCENT_OF, a multi-select of EARLIER codes only. Mirror the server rules client-side (exactly one LAND_VALUE, at most one ASSET_VALUE, multiplier 0-10, percentage 0-500) but still show the server's 400 text.
  Show a permanent banner on this page: "Rule sets define how compensation is calculated. Enter only values taken from the applicable law or notification." Never prefill numbers.
- **Valuation tab** (per awarded parcel): assets table with "Add asset" and "Void"; button "Calculate estimate" (`VALUATION_MANAGE`); the estimate card shows rule set name and version, reference date, rate and area used, and a **line-by-line breakdown table** (component, how it was calculated = `basis`, amount) and the total. Version history (superseded and rejected ones shown greyed). Buttons only from `availableActions`; approve and reject through a remarks dialog.
  Money is shown with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`. **Do not add up money in the browser**: show the server's totals (`totalAmount`, `approvedTotal`, summary fields).
- **Payments tab**: a prominent, non-dismissible banner "SIMULATED PAYMENTS: no real money is moved". Summary cards from `payment-summary` (instructed, sent, confirmed, failed). Table: beneficiary (see below), share %, amount, status badge, reference, attempts. Row actions from `availableActions`: "Release (simulated)", "Retry", and for a SENT payment "Simulate confirmation" and "Simulate failure" (reason required). Row detail: the events timeline from `/payments/{id}/events`. "Generate payments" per approved estimate (`PAYMENT_RELEASE`).
  Beneficiary column: payments carry only `landownerId`. If the user has `LANDOWNER_READ`, resolve the name through the landowner API (audited, only on demand, with the 5.13 banner); otherwise show "Beneficiary (hidden)". Never collect, display or store bank details.
- **R&R tab**: list of families (same masking rule for names) with status; "Identify family" (`RR_MANAGE`) with two plain switches, "Lost their home" and "Lost their livelihood", and notes. **There must be no field for caste, religion or any other sensitive attribute.** Detail: entitlements table, "Add benefit" (select from the catalogue, optional amount or months), "Approve" (not the identifier), "Mark delivered" (date, remarks), "Complete". The benefit catalogue page needs `RR_CATALOGUE`.
- Honest limits to state on the pages: payments are simulated (the real payment system needs official access); the legal formula is whatever the approved rule set says.

## Phase F8 (after F7): Valuation, compensation, payments, R&R
Types and API module, rate cards and rule-set screens with the component builder, valuation tab with the breakdown, payments tab with the simulated banner, R&R tab, tests.
*Done when:* with the full demo script's users, the rule maker drafts a rule set that SUPER_ADMIN approves, the scrutiny officer calculates an estimate whose breakdown matches the server, the authority approves it, the finance officer generates, releases, fails, retries and confirms simulated payments, and an R&R case reaches COMPLETED; no screen can approve its own maker's work (buttons hidden, server still enforces); the SIMULATED banner is always visible; `npm run build` and `npm run test` are green.
Tests: money formatting; breakdown rendering from a fixed response; component builder validation (one LAND_VALUE, only earlier codes selectable); buttons driven by `availableActions`; payments banner present; no field named like `bank`, `account`, `caste` or `religion` exists in any form.

## 5.16 GIS API (Module 6), base `/gis`
Permissions: `GIS_READ` (everyone who reads land records), `GIS_WRITE` (FIELD_OFFICER, SCRUTINY_OFFICER). Always use `/auth/me` permissions. Out-of-scope records return 404.
**Geometry is entered by officers as GeoJSON; the system never generates, guesses or downloads geometry. There is no base map and no external tile server.**
Coordinates are `[longitude, latitude]` (WGS84). The request body of a boundary or alignment is ONE bare GeoJSON geometry object, not a Feature.

```ts
export type Geometry = { type: 'Polygon'|'MultiPolygon'|'LineString'|'MultiLineString'; coordinates: unknown };
export interface Feature<P> { type: 'Feature'; geometry: Geometry; properties: P }
export interface FeatureCollection<P> { type: 'FeatureCollection'; features: Feature<P>[] }
export interface BoundaryResponse { parcelId: string; versionNo: number; areaHa: number; recordedAreaHa: number; variancePercent: number; vertices: number } // variance is information only
export interface BoundaryVersion { versionNo: number; areaHa: number; vertices: number; sourceNote: string|null; enteredByUsername: string; enteredAt: string; current: boolean }
export interface AlignmentResponse { projectId: string; versionNo: number; lengthKm: number; corridorWidthM: number; vertices: number }
export type MapProps =
  | { kind: 'CORRIDOR' } | { kind: 'ALIGNMENT'; lengthKm: number }
  | { kind: 'PARCEL'; parcelId: string; gatNumber: string|null; surveyNumber: string|null; classification: string; landUse: string; areaHa: number; inCase: boolean };
export interface Finding { code: string; severity: 'WARNING'|'INFO'; parcelId: string|null; message: string }
export interface AffectedParcel { parcelId: string; gatNumber: string|null; surveyNumber: string|null; classification: string; landUse: string; recordedAreaHa: number; boundaryAreaHa: number;
  affectedHa: number; caseNumber: string|null; areaToAcquireHa: number|null; flags: string[] }
export interface ConflictReport { projectId: string; projectCode: string; alignmentVersion: number; corridorWidthM: number; corridorAreaHa: number; parcelsInProjectVillages: number; parcelsWithBoundary: number;
  affectedParcelCount: number; totalAffectedHa: number; warnings: number; infos: number; affectedParcels: AffectedParcel[]; findings: Finding[]; limitations: string[] }
```

| Method | Path | Permission | Notes |
|---|---|---|---|
| PUT | `/parcels/{id}/boundary?sourceNote=` | `GIS_WRITE` | body = GeoJSON Polygon or MultiPolygon; 400 with the reason if invalid (self-crossing, wrong type, elevation values, swapped or non-Indian coordinates, too many points, too small); a new call creates the next version |
| GET | `/parcels/{id}/boundary`, `/parcels/{id}/boundary/history` | `GIS_READ` | Feature (404 if none); version list |
| GET | `/villages/{id}/parcels` | `GIS_READ` | FeatureCollection of the current boundaries (at most 2000) |
| PUT | `/projects/{id}/alignment?corridorWidthM=&sourceNote=` | `GIS_WRITE` | body = LineString or MultiLineString; width 1 to 1000 m |
| GET | `/projects/{id}/alignment`, `/corridor`, `/alignment/history` | `GIS_READ` | Features and versions |
| GET | `/projects/{id}/map` | `GIS_READ` | FeatureCollection: the corridor, the alignment and the parcels that cross it |
| GET | `/projects/{id}/conflicts` | `GIS_READ` | the ConflictReport; 404 if the project has no alignment yet |

Finding codes: `FOREST_LAND`, `WATER_BODY`, `GOVERNMENT_LAND`, `NOT_IN_ACQUISITION_CASE`, `NO_ACQUISITION_CASE_YET`, `IN_ANOTHER_PROJECT_CASE`, `AREA_TO_ACQUIRE_DIFFERS`, `BOUNDARY_AREA_DIFFERS_FROM_RECORD`,
`CASE_PARCEL_OUTSIDE_CORRIDOR`, `CASE_PARCEL_WITHOUT_BOUNDARY`, `PARCEL_OVERLAP`, `SURVEY_POINT_OUTSIDE_PARCEL`, `PARCELS_WITHOUT_BOUNDARY`.
**The findings are indicators, not legal decisions. Always show `limitations` on the report page, and never write "violation", "illegal" or "approved/rejected" for a finding.**

## 8.17 Map and conflict screens
New tab **Map and conflicts** on the project details page (`GIS_READ`), a **Boundary** tab on the parcel details page, and an **Alignment** panel on the project page. The existing `/gis` district-coverage page stays as it is.
- **Map (no library, no tiles)**: render the `/map` FeatureCollection as an **inline SVG**. Projection: equirectangular with latitude correction, `x = (lon - lon0) * cos(lat0)`, `y = -(lat - lat0)`, fit the bounding box of all features into the viewBox with padding. Layers in this order: corridor (light fill),
  parcels (outline, `fill-rule="evenodd"`), alignment (line). Add a scale bar computed from metres per degree, a north arrow, a layer toggle, zoom in/out/reset **buttons** (do not hijack the mouse wheel), and a visible note "No base map: shapes are drawn from officer-entered data only".
  Never request map tiles or any external URL.
- **Colours must not carry meaning alone**: forest, water and government parcels also get a pattern or a text label; every parcel is a keyboard-focusable element (`tabindex="0"`, `role="button"`, an `aria-label` with the Gat number and flags) and is mirrored in a table beside the map. Selecting a parcel in either place highlights it in both.
- **Conflict report**: summary cards (parcels crossed, total hectares, warnings, infos, boundary coverage "x of y parcels have a boundary"), a findings list grouped by severity (WARNING first) with the parcel as a link to its details, the affected-parcels table (recorded, drawn and crossed area, case number, flags), and the **limitations** box always visible.
  Honest empty states: "No alignment recorded yet" (404), "No parcels cross the corridor".
- **Boundary tab (parcel)**: current version summary with the variance badge (information only, never an error), version history, and an entry form with a textarea and a ".geojson/.json file" input that reads the file **in the browser**. Before sending: parse JSON, accept a bare geometry (if the user pasted a Feature or FeatureCollection with one feature, take its geometry and say so),
  check the type, check that the first coordinate looks like `[lon, lat]` inside India (lon 68 to 97.5, lat 6 to 37.6) and warn if it looks swapped, enforce the 1,000,000 character limit, and draw a **preview** in the same SVG renderer. The server is still the authority: show its 400 text verbatim. Only `GIS_WRITE` sees the form.
- **Alignment panel (project)**: same entry form with a corridor width field (1 to 1000 m) and the resulting length and version.
- No drawing tools yet (mouse drawing is a later phase). No Aadhaar, owner names or other personal data appear on any map or report.

## Phase F9 (after F8): Maps and conflicts
Types and API module, the SVG map component, conflict report page, boundary and alignment entry with preview, tests.
*Done when:* with the full demo script's users, the field officer enters a boundary and an alignment from GeoJSON, the report lists the forest parcel, the overlap and the parcel missing from the case, the map shows corridor, alignment and parcels without a single network request to a tile host;
all findings are readable without colour; `npm run build` and `npm run test` are green.
Tests: projection function with known points (a square near 19.87 N is drawn about as wide as it is tall in metres), GeoJSON paste and file validation (bare geometry, Feature unwrap, swapped coordinates warning, size limit), findings sorted by severity, limitations always rendered,
parcel keyboard selection, `msw` configured with `onUnhandledRequest: 'error'` so any external request fails the test.

## 5.17 Monitoring API (Module 7, part 1), base `/monitoring`
Permissions: `DASHBOARD_READ` and `REPORT_READ` (all internal roles, not CONSULTANT or CITIZEN), `REPORT_EXPORT` (admin roles, AUDITOR, FINANCE_OFFICER, COMPETENT_AUTHORITY). Always use `/auth/me` permissions.
Every number is limited to the user's geographic scope by the server; asking for a district or state outside the scope returns 404. Dashboards hold **counts and totals only, never personal data**.

```ts
export interface StatusAmount { status: string; count: number; amount: number }
export interface TrendPoint { month: string /* 'YYYY-MM' */; proposalsSubmitted: number; casesOpened: number }
export interface DistrictRow { districtId: string; district: string; state: string; projects: number; openCases: number; parcels: number; areaToAcquireHa: number }
export interface Dashboard {
  generatedAt: string; level: 'NATIONAL'|'STATE'|'DISTRICT'|'SCOPED'; stateId: string|null; districtId: string|null;
  proposals: { byStatus: Record<string, number>; total: number; inReview: number; awaitingDecision: number; approved: number; rejected: number };
  projects: { byStatus: Record<string, number>; total: number; estimatedLandAreaHa: number };
  land: { activeParcels: number; totalAreaHa: number; parcelsWithBoundary: number; boundaryCoveragePercent: number; documentsPendingVerification: number };
  acquisition: { casesByStatus: Record<string, number>; totalCases: number; openCases: number; parcelsIdentified: number; areaToAcquireHa: number;
                 surveysByStatus: Record<string, number>; objectionsByStatus: Record<string, number>; awardsDeclared: number; possessionsRecorded: number };
  finance: null | { estimates: StatusAmount[]; payments: StatusAmount[]|null; rrCasesByStatus: Record<string, number>|null; paymentMode: 'SIMULATED'|null }; // null = no VALUATION_READ
  trend: TrendPoint[]; districts: DistrictRow[]; notes: string[];
}
export interface Column { key: string; label: string; type: 'TEXT'|'NUMBER'|'DATE'|'MONEY' }
export interface ReportInfo { code: 'PROJECTS'|'ACQUISITION_CASES'|'COMPENSATION'; title: string; description: string; columns: Column[] }
export interface ReportResult { code: string; title: string; columns: Column[]; rows: Record<string, string|number|null>[]; page: number; size: number; totalRows: number }
```

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/dashboard?stateId=&districtId=` | `DASHBOARD_READ` | no filter = national for a national user, or the user's own scope (`level: SCOPED`); `districtId` wins over `stateId` |
| GET | `/reports` | `REPORT_READ` | only the reports this user may run (COMPENSATION needs `VALUATION_READ`) |
| GET | `/reports/{code}?status=&stateId=&districtId=&page=&size=` | `REPORT_READ` | size 1 to 200; status = capital letters and underscores |
| GET | `/reports/{code}/export.csv?status=&stateId=&districtId=` | `REPORT_EXPORT` | UTF-8 with a BOM; refuses (400, with the row count) above 10,000 rows: ask the user to add a filter; needs the Authorization header (fetch as a blob) |

## 8.18 Dashboard and report screens
Pages from the project brief: **3 National Dashboard** `/dashboard/national`, **4 State Dashboard** `/dashboard/state/:stateId`, **5 District Dashboard** `/dashboard/district/:districtId`, **26 MIS Reports** `/reports`. Menu: Dashboard (`DASHBOARD_READ`), Reports (`REPORT_READ`).
One `DashboardView` component renders all three levels; the page only chooses the query. A user with a restricted scope lands on their own (`SCOPED`) view; a state or district chooser is built from `/auth/my-districts`.
- **Layout**: summary cards (proposals awaiting scrutiny, awaiting decision, active projects, parcels with boundary coverage %, open cases, area to acquire, awards, possessions), then status breakdowns, the six-month trend, and the district table (click a row to drill down to that district dashboard).
- **Charts**: `recharts` (already installed) may be used for the status bars and the trend. **Every chart needs a data table or text alternative next to it**, colour must never be the only carrier of meaning (use labels and patterns), and charts must have an accessible name.
- **Compensation panel**: render only when `finance` is not null. Show estimate totals by status; show the payments block only when `finance.payments` is not null, always under a non-dismissible banner "SIMULATED PAYMENTS: no real money has moved". If `finance` is null show a plain note: "Compensation figures need the valuation permission".
  Money: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`; never add up money in the browser, show the server's numbers.
- **Honest states**: loading skeletons, an empty state "No activity in this area yet" (all zeros are valid), a 404 message "This district or state is outside your area", and the `notes` array shown at the bottom ("Counts include only records inside your geographic scope", "Months are counted in Asia/Kolkata time").
- **Reports page**: a report chooser from `/reports`, filters (state or district from the user's scope, status), a paged table from `columns` and `rows` (format by `type`: NUMBER right-aligned, DATE as a local date, MONEY as INR), a total row count, and an "Export CSV" button only with `REPORT_EXPORT`.
  Export: call the endpoint through the shared Axios client with `responseType: 'blob'`, take the filename from `Content-Disposition`, save through a temporary anchor and `URL.revokeObjectURL`. On 400 show the server's message (it contains the row count) and keep the filters.
- **No fake data**: no dashboard number may come from a constant. Pages 24 (spatial reports), 25 (monitoring and SLA, comes with Module 7 part 2) and 30 (system settings) stay roadmap placeholders until their APIs exist.

## Phase F10 (after F9): Dashboards and MIS reports
Types and API module, `DashboardView`, three dashboard pages with drill-down, reports page with CSV download, tests.
*Done when:* with the full demo script's users the authority sees district numbers that match the script's output, the field officer sees no money, the finance officer exports a CSV that opens in a spreadsheet with correct text, a district outside the user's scope shows the "outside your area" state; `npm run build` and `npm run test` are green.
Tests: card and breakdown rendering from a fixed response; the finance panel hidden when `finance` is null and the SIMULATED banner always present when payments exist; role-based menu items; report table formatting by column type; blob download helper with the filename from the header; a 404 and a 400 export state.

## 5.18 SLA and settings API (Module 7, part 2), base `/monitoring`
Permissions: `SLA_READ` (all internal roles, not CONSULTANT or CITIZEN), `SETTINGS_MANAGE` (SUPER_ADMIN, CENTRAL_ADMIN). Always use `/auth/me` permissions. Out-of-scope districts return 404.
**Escalation only sends in-app notifications. It never changes the state of a proposal, case or payment. The default limits are DEMO values, not official policy: say so on the page.**

```ts
export type SlaItemType = 'PROPOSAL_AWAITING_SCRUTINY'|'DOCUMENT_AWAITING_VERIFICATION'|'SURVEY_AWAITING_VERIFICATION'|'OBJECTION_AWAITING_DECISION'|'OBJECTION_WINDOW_NOT_CLOSED'|'ESTIMATE_AWAITING_APPROVAL'|'PAYMENT_AWAITING_RELEASE'|'PAYMENT_AWAITING_RESPONSE';
export interface SlaTypeSummary { itemType: SlaItemType; title: string; onTime: number; warning: number; breach: number; warnAfterHours: number; breachAfterHours: number; responsibleRole: string }
export interface SlaItem { itemType: SlaItemType; title: string; entityId: string; reference: string; districtId: string; since: string; ageHours: number; level: 'WARNING'|'BREACH'; responsibleRole: string }
export interface SlaOverview { generatedAt: string; onTime: number; warning: number; breach: number; byType: SlaTypeSummary[]; items: SlaItem[]; itemsTruncated: boolean; notes: string[] }
export interface SlaRule { id: string; itemType: SlaItemType; title: string; warnAfterHours: number; breachAfterHours: number; responsibleRole: string; escalateRole: string|null; active: boolean; note: string|null; rowVersion: number }
export interface SlaRuleRequest { warnAfterHours: number; breachAfterHours: number; responsibleRole: string; escalateRole?: string|null; active: boolean; rowVersion: number } // hours 0..8760, breach > warn
export interface ScanResult { scannedAt: string; warningsRaised: number; breachesRaised: number; notificationsSent: number }
export interface Escalation { id: string; itemType: SlaItemType; entityId: string; reference: string; level: 'WARNING'|'BREACH'; thresholdHours: number; since: string; responsibleRole: string; escalateRole: string|null; triggeredBy: string; createdAt: string }
export interface Settings { paymentMode: 'SIMULATED'; maxUploadMb: number; allowedUploadTypes: string[]; exportMaxRows: number; slaSchedulerEnabled: boolean; slaScanIntervalMinutes: number; businessTimeZone: string; notes: string[] }
```

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/sla?stateId=&districtId=` | `SLA_READ` | counts per type and level plus up to 200 overdue items (breaches first); `itemsTruncated` says if there are more |
| GET | `/sla/rules` | `SLA_READ` | the 8 rules |
| PUT | `/sla/rules/{itemType}` | `SETTINGS_MANAGE` | 409 if `rowVersion` is stale (reload and retry), 400 for bad limits or roles |
| POST | `/sla/scan?districtId=` | `SETTINGS_MANAGE` | scans now; idempotent (a second scan raises nothing new) |
| GET | `/sla/escalations?districtId=&page=&size=` | `SLA_READ` | size at most 100; `{ rows, page, size, totalRows }` |
| GET | `/settings` | `SETTINGS_MANAGE` | read-only deployment settings |

Item types and where to link (`entityId`): PROPOSAL_AWAITING_SCRUTINY to the proposal; OBJECTION_WINDOW_NOT_CLOSED to the acquisition case; DOCUMENT_AWAITING_VERIFICATION to the land document (open its parcel); SURVEY, OBJECTION, ESTIMATE and PAYMENT items to the case through the `reference` (which starts with the case number), because their ids are not page ids.
If a link target is unknown, show the reference as text rather than guessing a route.

## 8.19 Monitoring and System settings screens
Pages **25 Monitoring** `/monitoring` (`SLA_READ`) and **30 System Settings** `/settings` (`SETTINGS_MANAGE`).
- **Monitoring**: three cards (on time, warning, breach) and a table per item type (title, counts, limits in days and hours, responsible role). Below it the overdue list (level badge with text, not only colour; reference; waiting time as "x days y hours"; since; responsible role). A district/state selector from `/auth/my-districts`.
  Show the `notes` at the bottom and this fixed sentence: "Alerts are notifications only. Nothing is changed automatically." Honest states: "Nothing is overdue" (all zeros), "Showing 200 of N overdue items" when `itemsTruncated`.
- **Escalation log** tab: the paged table from `/sla/escalations`.
- **System settings** (administrators): a read-only "Deployment settings" card from `/settings`, with a non-dismissible note "Payments are SIMULATED" and the `notes`. An **SLA limits** editor: one row per rule with hour fields shown as days and hours (warning, breach), responsible role, escalation role, active switch; save sends `rowVersion`; on 409 reload the row and tell the user "someone else changed this".
  Show each rule's `note`; while it says "DEMO default" display a badge "DEMO default: not official policy". A "Scan now" button (with a district chooser) that shows the three numbers returned.
- No secrets, passwords or tokens are ever displayed or logged here. Hours are converted for display only; send hours.

## Phase F11 (after F10): Monitoring and settings
Types and API module, monitoring page with the overdue list, escalation log, system settings with the SLA editor and scan button, tests.
*Done when:* with the demo script's users the competent authority sees the late proposal, the administrator changes a limit and runs a scan, a second scan shows zeros, and a stale save shows the conflict message; consultants have no menu entry; `npm run build` and `npm run test` are green.
Tests: hours to "days and hours" formatting; limits validation (breach longer than warning); 409 and 404 states; truncated-list notice; the notification-only sentence always rendered; settings hidden without `SETTINGS_MANAGE`.