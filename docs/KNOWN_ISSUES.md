# LandNexus / NLAMS — Known Issues

**Last updated:** 15 November 2026  
**Meaning:** these are real, current limitations. They are not hidden “implemented but unlinked” features, and the UI must not present them as finished.

---

## 1. Open defects and gaps

| ID | Severity | Area | Issue | Current behaviour | Planned resolution |
|---|---|---|---|---|---|
| — | P1 | Proposals | Named officer routing and configurable escalation targets are not managed in routing rules. | Authorized users can manually reassign an open proposal task to an eligible officer; the action is scoped, reasoned and audited. | Extend routing/SLA administration for named targets and escalation policies. |
| — | P2 | Documents | Uploads are type/size validated but not malware-scanned or encrypted at rest. | Files are stored with random names outside the project; downloads and previews are authenticated and audited. | Phase 3 hardening: scanner decision, encryption/key-management decision, retention/legal hold. |
| — | P2 | Notifications | Notification preferences and contacts have no self-service UI. | Contacts/preferences can only be changed by direct database writes. External delivery is opt-in and unproven against a real provider. | Phase 2/3: preference screen and delivery console. |
| — | P2 | Monitoring | Only the NLAMS page polls; other dashboards and reports are snapshots. | Refresh happens on navigation or by explicit button. | Phase 2 reporting work if required. |
| — | P1 | Analytics | Dashboard payment-channel/status analytics have not been verified against PostgreSQL after V26. | V26 adds explicit simulated `UNCLASSIFIED`, `PFMS_SIMULATED`, `DBT_SIMULATED`, and `OTHER_SIMULATED` labels without inferring rails. Dashboard status/date/project/district/taluka filters are wired through the aggregates, comparisons, trends, pending tasks, escalations and exports. Existing direct-SQL evidence predates V26 and does not verify these additions. | Apply V26 on the disposable DB and compare each filtered aggregate with direct SQL. |
| — | P1 | Geographic permissions | User scopes currently stop at state/division/district. | Master data is hierarchical through village, but operational scope queries do not yet enforce taluka/village assignments end-to-end. | Design and test scope propagation across GIS, acquisition, compensation and reporting before adding lower-level grants. |
| — | P1 | User administration | Per-user permission overrides, token invalidation and audit views are implemented, but administrative coverage remains incomplete. | V24/V25 APIs enforce explicit permission overrides and immediate token invalidation; profile editing is limited to email/name, role-permission history is available to `AUDIT_READ`, and user role-assignment history remains in the general audit view. Geographic assignment management is incomplete. | Complete scoped user administration and test every management endpoint against role and geographic authority boundaries. |
| — | P1 | SLA escalation | SLA has one warning threshold and one breach threshold per type, with role notifications; there are no configurable multi-level/named-officer targets. | Opt-in scheduler and permission-gated manual scan use existing persisted escalation history; the admin UI edits the existing rule contract. | Add multilevel target configuration, retry/delivery outcome persistence and database-backed scheduler tests. |
| — | P2 | Demo dataset | Existing seed scripts generate fictional demo data but do not cover every requested module or provide fixed-key idempotence. | `scripts/full-demo.ps1` passed twice on the disposable database; selected row counts and foreign-key relationships were measured; current parcel geometries are valid. | Add missing PFMS/DBT and administration/routing lifecycle records; make run-key behavior explicit and expand integrity checks. |
| — | P2 | GIS | Data ingestion and authoritative coverage remain limited. | `/gis` uses scoped stored GeoJSON and allows supported polygon parcel-boundary and project-alignment uploads to existing PostGIS APIs. It does not provide official boundary catalogues or general acquisition-boundary ingestion. | Extend ingestion only after confirming provenance, validation requirements and access rights. |
| — | P2 | Payments | The requested standalone DBT beneficiary/NPCI workflow is not implemented. | Existing compensation payments are simulated, and confirmed transactions offer a protected text receipt; no real PFMS/DBT rail is connected. | Implement a separately modelled sandbox simulation only if required; preserve DEMO labelling and avoid real credentials/data. |
| — | P3 | External integrations | No BhuNaksha, 7/12/8A/Ferfar, live Bhuvan or PFMS/DBT connection. | Officer-entered records, OSM fallback mapping and SIMULATED compensation payments only. | Integrate only against verified, authorized endpoints with explicit configuration and tests. |
| — | P3 | Auth | Every authenticated API request now checks the token's authorization version against the live user record. | V25 invalidates existing access tokens after role, permission, profile, or account-status changes; refresh tokens are revoked on permission changes and disablement. This adds a database lookup to JWT validation, so database availability is required for authenticated requests. | Monitor the validation query and consider a revocation cache only if it preserves immediate invalidation semantics. |
| — | P3 | Config | `spring.jpa.show-sql=true` is on for development. | SQL is logged. | Turn off for any shared demo/production profile. |

---

## 2. Verification constraints

- Database-backed tests must use a dedicated disposable database through `LANDNEXUS_TEST_DB_*`. They fail fast if the URL points at `landnexus_dev`. The latest suite used `landnexus_nlams_test_20261115`.
- Docker/Testcontainers is not available in this environment, so concurrency tests run against the local disposable PostgreSQL instance rather than an ephemeral container.
- Full frontend and backend suite results, V23, demo seed, scheduler, and SQL checks are recorded in `docs/TESTING_AND_VERIFICATION.md`; do not claim a pass for any unrun command.
- No commit or push has been made. The working tree contains uncommitted changes and untracked documentation.

---

## 3. Data and demo rules

- All demo records are synthetic and labelled `DEMO`.
- Payments are `SIMULATED`; no real money moves.
- Do not load real personal, land or payment data.
- Do not “fix” V16 duplicate acquisition-case data by deleting rows. Reconcile it deliberately with human approval.
- Never run destructive database commands or reset/recreate a shared database to make a test pass.

---

## 4. Implemented administrative capabilities

- Role permissions can be changed through the permission matrix by authorized `ROLE_MANAGE` users. The backend validates permissions and records role-permission changes in the audit log; this is not a complete user lifecycle/geographic permission administration console.
- Routing rules can be listed, created, edited, activated and deactivated through the guarded admin UI/API. The service validates rule ranges and prevents removal of the final active rule. Manual officer reassignment is audited; named officer/workload routing and multi-tier escalation-target administration remain open.
- Proposal reassignment is now available from proposal details to users with `PROPOSAL_ASSIGNMENT_MANAGE`; eligible candidates are backend-filtered, and the reason and assignment history are audited. Database-backed endpoint verification remains pending an isolated test database.
- User profile email/name editing now uses `PUT /administration/users/{id}`; the backend prevents duplicate email and non-super-admin modification of a SUPER_ADMIN target, and writes an audit event. Usernames remain immutable; V24 per-user module permission overrides are available.

## 6. Dashboard analytics continuation

- The main dashboard accepts project, taluka, inclusive date and status filters. Backend scope resolution validates the dimensions before database queries; project filtering also enforces proposal read/ownership rules.
- GIS conflict, pending task, escalation-level and workload values are aggregated from PostgreSQL; officer identities/workload are permission-gated. Dashboard response fixtures and integration tests cover the added fields and direct-SQL comparisons.
- The full backend suite passed 579 tests against the isolated database, frontend tests passed 50 files/250 tests, and the production build exited successfully after the dashboard change.
- V26 introduces explicit simulated payment-channel classification and the dashboard exposes per-channel aggregates. The changes from this continuation are not yet verified against PostgreSQL because the local environment currently lacks all `LANDNEXUS_TEST_DB_*` settings; do not treat compile/unit/frontend results as migration or SQL evidence.
- Dashboard export routes use the existing scoped CSV report APIs; Excel/PDF export formats are not supported by the current architecture.

## 5. Deferred by phase

| Item | Deferred to |
|---|---|
| Manual proposal reassignment and named routing/escalation targets | Future phase |
| Notification preferences/delivery console | Phase 2 |
| Simulated government integrations | Phase 3 |
| Citizen portal and grievances | Phase 3 |
| Malware scanning, encryption, token invalidation, deployment hardening | Phase 3 |
