-- V5: Module 2 - proposals, versions, status history, projects, notifications.
-- Geography and department are referenced by id; the administration module owns those tables.

CREATE SEQUENCE proposal_number_seq START 1;
CREATE SEQUENCE project_number_seq START 1;

CREATE TABLE proposals (
    id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_number        VARCHAR(30),
    title                  VARCHAR(200)  NOT NULL,
    project_type           VARCHAR(40)   NOT NULL,
    status                 VARCHAR(30)   NOT NULL,
    version_no             INTEGER       NOT NULL DEFAULT 0,
    state_id               UUID          NOT NULL REFERENCES states (id),
    district_id            UUID          NOT NULL REFERENCES districts (id),
    taluka_id              UUID          REFERENCES talukas (id),
    department_id          UUID          NOT NULL REFERENCES departments (id),
    length_km              NUMERIC(10,2),
    estimated_land_area_ha NUMERIC(12,2) NOT NULL,
    alignment_description  VARCHAR(1000),
    description            VARCHAR(2000) NOT NULL,
    planned_start_date     DATE          NOT NULL,
    planned_end_date       DATE          NOT NULL,
    owner_user_id          UUID          NOT NULL REFERENCES users (id),
    recommended_by_user_id UUID          REFERENCES users (id),
    submitted_at           TIMESTAMPTZ,
    row_version            BIGINT        NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by             VARCHAR(100),
    updated_by             VARCHAR(100),
    CONSTRAINT uq_proposals_number UNIQUE (proposal_number),
    CONSTRAINT ck_proposals_status CHECK (status IN
        ('DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'CLARIFICATION_REQUESTED', 'RECOMMENDED', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_proposals_type CHECK (project_type IN
        ('NATIONAL_HIGHWAY', 'STATE_HIGHWAY', 'DISTRICT_ROAD', 'RURAL_ROAD', 'EXPRESSWAY', 'RAILWAY', 'DAM',
         'IRRIGATION', 'SCHOOL', 'HOSPITAL', 'GOVERNMENT_BUILDING', 'OTHER_INFRASTRUCTURE')),
    CONSTRAINT ck_proposals_dates CHECK (planned_end_date > planned_start_date),
    CONSTRAINT ck_proposals_length CHECK (length_km IS NULL OR length_km > 0),
    CONSTRAINT ck_proposals_land CHECK (estimated_land_area_ha > 0),
    CONSTRAINT ck_proposals_number_after_submit CHECK (status = 'DRAFT' OR proposal_number IS NOT NULL)
);
CREATE INDEX idx_proposals_district ON proposals (district_id);
CREATE INDEX idx_proposals_owner    ON proposals (owner_user_id);
CREATE INDEX idx_proposals_status   ON proposals (status);

CREATE TABLE proposal_villages (
    proposal_id UUID NOT NULL REFERENCES proposals (id),
    village_id  UUID NOT NULL REFERENCES villages (id),
    PRIMARY KEY (proposal_id, village_id)
);

CREATE TABLE proposal_versions (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id         UUID          NOT NULL REFERENCES proposals (id),
    version_no          INTEGER       NOT NULL,
    snapshot            VARCHAR(5000) NOT NULL,
    created_by_user_id  UUID,
    created_by_username VARCHAR(100)  NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_proposal_versions UNIQUE (proposal_id, version_no)
);

CREATE TABLE proposal_status_history (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id    UUID          NOT NULL REFERENCES proposals (id),
    from_status    VARCHAR(30),
    to_status      VARCHAR(30)   NOT NULL,
    action         VARCHAR(40)   NOT NULL,
    actor_user_id  UUID,
    actor_username VARCHAR(100)  NOT NULL,
    reason         VARCHAR(1000),
    occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_history_proposal ON proposal_status_history (proposal_id, occurred_at);

-- Versions and history are append-only (function created in V4).
CREATE TRIGGER trg_proposal_versions_append_only
    BEFORE UPDATE OR DELETE ON proposal_versions
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TRIGGER trg_proposal_status_history_append_only
    BEFORE UPDATE OR DELETE ON proposal_status_history
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TABLE projects (
    id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                   VARCHAR(30)   NOT NULL,
    proposal_id            UUID          NOT NULL REFERENCES proposals (id),
    title                  VARCHAR(200)  NOT NULL,
    project_type           VARCHAR(40)   NOT NULL,
    status                 VARCHAR(20)   NOT NULL,
    state_id               UUID          NOT NULL REFERENCES states (id),
    district_id            UUID          NOT NULL REFERENCES districts (id),
    taluka_id              UUID          REFERENCES talukas (id),
    department_id          UUID          NOT NULL REFERENCES departments (id),
    length_km              NUMERIC(10,2),
    estimated_land_area_ha NUMERIC(12,2) NOT NULL,
    owner_user_id          UUID          NOT NULL REFERENCES users (id),
    approved_by_user_id    UUID          NOT NULL REFERENCES users (id),
    approved_at            TIMESTAMPTZ   NOT NULL,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by             VARCHAR(100),
    updated_by             VARCHAR(100),
    CONSTRAINT uq_projects_code UNIQUE (code),
    CONSTRAINT uq_projects_proposal UNIQUE (proposal_id),
    CONSTRAINT ck_projects_status CHECK (status IN ('ACTIVE', 'CLOSED'))
);
CREATE INDEX idx_projects_district ON projects (district_id);
CREATE INDEX idx_projects_owner    ON projects (owner_user_id);

CREATE TABLE project_villages (
    project_id UUID NOT NULL REFERENCES projects (id),
    village_id UUID NOT NULL REFERENCES villages (id),
    PRIMARY KEY (project_id, village_id)
);

CREATE TABLE notifications (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID          NOT NULL REFERENCES users (id),
    type              VARCHAR(40)   NOT NULL,
    title             VARCHAR(200)  NOT NULL,
    message           VARCHAR(1000) NOT NULL,
    entity_type       VARCHAR(60),
    entity_id         UUID,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, created_at DESC);

INSERT INTO permissions (code, description) VALUES
    ('PROPOSAL_CREATE',     'Create, edit, submit and resubmit own proposals (consultants)'),
    ('PROPOSAL_READ_OWN',   'View own proposals and projects'),
    ('PROPOSAL_READ',       'View proposals and projects within the geographic scope'),
    ('PROPOSAL_SCRUTINIZE', 'Start scrutiny, request clarification, recommend or reject during scrutiny'),
    ('PROPOSAL_DECIDE',     'Approve or reject a recommended proposal (competent authority)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('PROPOSAL_CREATE', 'PROPOSAL_READ_OWN')
WHERE r.code = 'CONSULTANT';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('PROPOSAL_READ', 'PROPOSAL_SCRUTINIZE')
WHERE r.code = 'SCRUTINY_OFFICER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('PROPOSAL_READ', 'PROPOSAL_DECIDE')
WHERE r.code = 'COMPETENT_AUTHORITY';

-- Oversight roles may read (within their scope); they cannot create, scrutinise or decide.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'PROPOSAL_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN',
                 'DISTRICT_ADMIN', 'FIELD_OFFICER', 'FINANCE_OFFICER', 'AUDITOR');
