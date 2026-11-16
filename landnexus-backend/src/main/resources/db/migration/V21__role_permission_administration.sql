-- V21: Role and permission administration (BUG-008).
-- Adds a dedicated authority for editing role definitions. It is deliberately granted only to
-- SUPER_ADMIN: role-permission changes are the most powerful administrative operation in the system.
-- No existing role, permission or grant is removed or rewritten.

INSERT INTO permissions (code, description) VALUES
    ('ROLE_MANAGE', 'Change the permission set of a role, with audit and self-lockout protection');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ROLE_MANAGE'
WHERE r.code = 'SUPER_ADMIN';

-- Supports "which roles does this permission belong to" checks and the admin matrix without a full scan.
CREATE INDEX idx_role_permissions_permission ON role_permissions (permission_id);
