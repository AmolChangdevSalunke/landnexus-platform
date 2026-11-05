# Module 2 - Consultant Proposals and Government Projects (Slice 3a)

Status: **implemented, not yet verified on the project machine** until `mvnw clean verify` and `proposal-workflow-demo.ps1` have been run.

## The workflow (one rule table: `ProposalWorkflow`)

```
DRAFT --SUBMIT--> SUBMITTED --START_SCRUTINY--> UNDER_SCRUTINY
UNDER_SCRUTINY --REQUEST_CLARIFICATION (reason required)--> CLARIFICATION_REQUESTED --RESUBMIT--> SUBMITTED
UNDER_SCRUTINY --RECOMMEND--> RECOMMENDED --APPROVE--> APPROVED  (a project is created)
UNDER_SCRUTINY --REJECT_SCRUTINY (reason required)--> REJECTED
RECOMMENDED    --REJECT (reason required)-->          REJECTED
```
APPROVED and REJECTED are final. Anything not in the table is refused with 409.

| Action | Permission | Extra rule |
|---|---|---|
| SUBMIT, RESUBMIT | PROPOSAL_CREATE | only the consultant who owns the proposal |
| START_SCRUTINY, REQUEST_CLARIFICATION, RECOMMEND, REJECT_SCRUTINY | PROPOSAL_SCRUTINIZE | nobody reviews their own proposal |
| APPROVE, REJECT | PROPOSAL_DECIDE | nobody reviews their own proposal; **the officer who recommended it cannot decide it** |

## Roles and visibility
| Role | Permissions |
|---|---|
| CONSULTANT | PROPOSAL_CREATE, PROPOSAL_READ_OWN (sees only own proposals and projects) |
| SCRUTINY_OFFICER | PROPOSAL_READ, PROPOSAL_SCRUTINIZE |
| COMPETENT_AUTHORITY | PROPOSAL_READ, PROPOSAL_DECIDE |
| SUPER_ADMIN, CENTRAL_ADMIN, MINISTRY_ADMIN, STATE_ADMIN, DIVISION_ADMIN, DISTRICT_ADMIN, FIELD_OFFICER, FINANCE_OFFICER, AUDITOR | PROPOSAL_READ only (cannot create, scrutinise or decide) |
PROPOSAL_READ shows records in the user's geographic scope (nationwide roles see all). A consultant can only create proposals in districts inside their own scope. A record the caller may not see answers **404**, not 403, so its existence is not revealed.

## Proposal data
Title, project type (12 kinds), district (state is derived from it), optional taluka, department, length in km (required for roads, expressways, railways), estimated land area in **hectares**, the affected **villages** (a list of village ids, all inside the chosen district), alignment description, description, planned start and end dates (end after start). Attachments arrive with the secure file storage in Module 3. A map alignment arrives with the GIS module.

## Numbers
`PRP-2026-000001` (assigned at the first submission) and `PRJ-2026-000001` come from database sequences, so two records can never get the same number. A rolled-back transaction can leave a gap in the sequence; that is expected.

## Records kept
- **History** (`proposal_status_history`): every change with actor, time, action and reason. Append-only (database trigger).
- **Versions** (`proposal_versions`): a frozen copy at every submission and resubmission (v1, v2, ...). Append-only.
- **Audit trail**: every action also writes an audit event.
- **Concurrency**: two people changing the same proposal at once - the second gets 409 and must reload.

## Notifications
Submit/resubmit: scrutiny officers whose scope covers the district. Recommend: competent authorities in scope. Scrutiny started, clarification, approval, rejection: the owner. Read with `GET /api/v1/notifications` (`?unreadOnly=true`), `GET /api/v1/notifications/unread-count`, `POST /api/v1/notifications/{id}/read`. Users only ever see their own.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/projects/proposals` | create a draft |
| GET | `/api/v1/projects/proposals?status=&districtId=&page=&size=` | list (visibility rules above) |
| GET / PUT | `/api/v1/projects/proposals/{id}` | PUT only in DRAFT or CLARIFICATION_REQUESTED, owner only; GET returns `availableActions` |
| GET | `/api/v1/projects/proposals/{id}/history`, `/versions` | |
| POST | `/{id}/submit`, `/resubmit`, `/start-scrutiny`, `/recommend`, `/approve` | optional body `{"reason": "..."}` |
| POST | `/{id}/clarification` | body `{"reason": "..."}` required |
| POST | `/{id}/reject` | body `{"reason": "..."}` required; during scrutiny or after a recommendation |
| GET | `/api/v1/projects`, `/api/v1/projects/{id}` | projects (read-only; created by approval) |

## Not in this slice
Attachments (Module 3), alignment geometry (Module 6), project milestones and progress (Module 7), SLA timers and escalation (Module 7), e-mail/SMS notifications.

## Tests
Unit: workflow engine and proposal table, ProposalService (every transition, wrong state, wrong role, separation of duties, validation, visibility), access rules, lookup API, notifications. Controller: validation and error shapes. Integration (real database, real tokens): the full workflow with three roles, permissions, scope, separation of duties, rejection, validation, notifications, numbering.
