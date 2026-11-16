-- V22: explicit permission for audited manual proposal reassignment.
INSERT INTO permissions (code, description) VALUES
    ('PROPOSAL_ASSIGNMENT_MANAGE', 'Reassign an open proposal task to an eligible officer within geographic scope');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'PROPOSAL_ASSIGNMENT_MANAGE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN');
