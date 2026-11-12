-- V17: NLAMS automated proposal routing. Additive: no proposal status is changed and no existing transition is altered.
-- A proposal gets at most one open assignment per stage. Reassignment closes the old row (REASSIGNED) and opens a new one.
CREATE TABLE routing_rules (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    min_area_ha   NUMERIC(12,2),
    max_area_ha   NUMERIC(12,2),
    project_type  VARCHAR(40),
    decision_level VARCHAR(20) NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    note          VARCHAR(300),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_routing_rule_name UNIQUE (name),
    CONSTRAINT ck_routing_rule_area CHECK (min_area_ha IS NULL OR min_area_ha >= 0),
    CONSTRAINT ck_routing_rule_range CHECK (max_area_ha IS NULL OR min_area_ha IS NULL OR max_area_ha > min_area_ha),
    CONSTRAINT ck_routing_rule_level CHECK (decision_level IN ('DISTRICT', 'STATE', 'CENTRAL'))
);
CREATE INDEX idx_routing_rules_active ON routing_rules (active, decision_level);

-- DEMO defaults, not official policy: up to and including 100 ha is a district-level decision, above it a state-level one.
INSERT INTO routing_rules (name, min_area_ha, max_area_ha, project_type, decision_level, note) VALUES
    ('DEMO district decision up to 100 ha', 0, 100, NULL, 'DISTRICT',
     'DEMO default for illustration, not official policy: set the real routing rules in System settings'),
    ('DEMO state decision above 100 ha', 100, NULL, NULL, 'STATE',
     'DEMO default for illustration, not official policy: set the real routing rules in System settings');

CREATE TABLE proposal_assignments (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id       UUID        NOT NULL REFERENCES proposals (id),
    stage             VARCHAR(20) NOT NULL,
    assigned_user_id  UUID        NOT NULL REFERENCES users (id),
    assigned_by       VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    rule_note         VARCHAR(300),
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    due_at            TIMESTAMPTZ,
    CONSTRAINT ck_assignment_stage CHECK (stage IN ('SCRUTINY', 'DECISION')),
    CONSTRAINT ck_assignment_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNED')),
    CONSTRAINT ck_assignment_started CHECK (started_at IS NULL OR started_at >= assigned_at),
    CONSTRAINT ck_assignment_completed CHECK (completed_at IS NULL OR completed_at >= assigned_at)
);
CREATE UNIQUE INDEX uq_assignment_open_stage ON proposal_assignments (proposal_id, stage)
    WHERE status IN ('PENDING', 'IN_PROGRESS');
CREATE INDEX idx_assignments_proposal ON proposal_assignments (proposal_id, assigned_at);
CREATE INDEX idx_assignments_user_open ON proposal_assignments (assigned_user_id, status);

INSERT INTO permissions (code, description) VALUES
    ('ROUTING_RULE_READ',   'View the automatic proposal routing rules'),
    ('ROUTING_RULE_MANAGE', 'Create, change and deactivate automatic proposal routing rules');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ROUTING_RULE_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN',
                 'DISTRICT_ADMIN', 'SCRUTINY_OFFICER', 'COMPETENT_AUTHORITY', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ROUTING_RULE_MANAGE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN');
