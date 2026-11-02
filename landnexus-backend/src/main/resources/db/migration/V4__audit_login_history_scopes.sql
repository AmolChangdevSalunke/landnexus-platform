-- V4: audit trail, login history and geographic scopes.

CREATE TABLE audit_events (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actor_user_id  UUID,
    actor_username VARCHAR(100)  NOT NULL,
    action         VARCHAR(40)   NOT NULL,
    entity_type    VARCHAR(60)   NOT NULL,
    entity_id      UUID,
    details        VARCHAR(2000)
);
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_events (actor_username);
CREATE INDEX idx_audit_time   ON audit_events (occurred_at DESC);

-- No foreign key to users on purpose: history must outlive the account.
CREATE TABLE login_history (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID,
    username_attempted VARCHAR(60)  NOT NULL,
    success            BOOLEAN      NOT NULL,
    failure_reason     VARCHAR(40),
    ip_address         VARCHAR(45),
    user_agent         VARCHAR(255),
    occurred_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_history_user ON login_history (username_attempted, occurred_at DESC);
CREATE INDEX idx_login_history_time ON login_history (occurred_at DESC);

-- Append-only: rows can be added but never changed or removed through normal SQL.
-- (A database superuser could still drop the trigger, so this is tamper-resistant, not tamper-proof.)
CREATE FUNCTION forbid_change_of_history() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_append_only
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TRIGGER trg_login_history_append_only
    BEFORE UPDATE OR DELETE ON login_history
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TABLE user_geographic_scopes (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id),
    state_id    UUID         REFERENCES states (id),
    division_id UUID         REFERENCES divisions (id),
    district_id UUID         REFERENCES districts (id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    CONSTRAINT ck_scope_exactly_one CHECK (num_nonnulls(state_id, division_id, district_id) = 1)
);
CREATE INDEX idx_scopes_user ON user_geographic_scopes (user_id);

INSERT INTO permissions (code, description) VALUES
    ('AUDIT_READ', 'View the audit trail and login history');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'AUDIT_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'AUDITOR');
