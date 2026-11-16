-- V24: per-user permission overrides. Role grants remain the default; explicit allow/deny
-- entries are applied when new access tokens are issued. All changes are separately audited.
CREATE TABLE user_permission_overrides (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users (id),
    permission_id UUID         NOT NULL REFERENCES permissions (id),
    granted       BOOLEAN      NOT NULL,
    changed_by    VARCHAR(100) NOT NULL,
    changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_permission_override UNIQUE (user_id, permission_id)
);

CREATE INDEX idx_user_permission_overrides_user ON user_permission_overrides (user_id);

INSERT INTO permissions (code, description)
VALUES ('USER_PERMISSION_MANAGE', 'Set audited per-user permission overrides');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN' AND p.code = 'USER_PERMISSION_MANAGE';
