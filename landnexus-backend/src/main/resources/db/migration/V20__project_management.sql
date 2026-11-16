-- V20: project register management. Projects are still created only by approving a proposal,
-- but administrators may now correct project details and close or reopen a project.
-- No existing row is changed and no project is deleted.

INSERT INTO permissions (code, description) VALUES
    ('PROJECT_MANAGE', 'Edit project details and close or reopen a government project');

-- Geographic administrators manage projects inside their scope; central roles manage all.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'PROJECT_MANAGE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN');

-- Guard the values a project edit can change. NOT VALID keeps any legacy row usable while
-- still enforcing the rule for every new insert and update.
ALTER TABLE projects
    ADD CONSTRAINT ck_projects_title_nonblank CHECK (btrim(title) <> '') NOT VALID;
ALTER TABLE projects
    ADD CONSTRAINT ck_projects_land_positive CHECK (estimated_land_area_ha > 0) NOT VALID;
ALTER TABLE projects
    ADD CONSTRAINT ck_projects_length_positive CHECK (length_km IS NULL OR length_km > 0) NOT VALID;
