-- V3: Security - permissions, roles, users, refresh tokens.
-- Roles and permissions are reference data (not personal data). No user accounts are created here:
-- the first SUPER_ADMIN is created at startup from environment variables (see BootstrapAdminService).

CREATE TABLE permissions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(60)  NOT NULL,
    description VARCHAR(200) NOT NULL,
    CONSTRAINT uq_permissions_code UNIQUE (code)
);

CREATE TABLE roles (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(40)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    CONSTRAINT uq_roles_code UNIQUE (code)
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles (id),
    permission_id UUID NOT NULL REFERENCES permissions (id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username              VARCHAR(60)  NOT NULL,
    email                 VARCHAR(150) NOT NULL,
    full_name             VARCHAR(150) NOT NULL,
    password_hash         VARCHAR(100) NOT NULL,
    enabled               BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by            VARCHAR(100),
    updated_by            VARCHAR(100),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_username_lower CHECK (username = lower(username)),
    CONSTRAINT ck_users_email_lower CHECK (email = lower(email))
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users (id),
    role_id UUID NOT NULL REFERENCES roles (id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id),
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_user_roles_role     ON user_roles (role_id);

-- Permissions (interim set; later modules add their own in new migrations)
INSERT INTO permissions (code, description) VALUES
    ('MASTER_DATA_READ',  'View ministries, departments and administrative geography'),
    ('MASTER_DATA_WRITE', 'Create, change, activate and deactivate master data'),
    ('USER_READ',         'View users and roles'),
    ('USER_WRITE',        'Create users, change roles, enable or disable accounts');

-- The 13 roles required by the project
INSERT INTO roles (code, name, description) VALUES
    ('SUPER_ADMIN',         'Super Administrator',   'Full system control, including other administrators'),
    ('CENTRAL_ADMIN',       'Central Administrator', 'Central Government administration'),
    ('MINISTRY_ADMIN',      'Ministry Administrator','Ministry and department administration'),
    ('STATE_ADMIN',         'State Administrator',   'State Government administration'),
    ('DIVISION_ADMIN',      'Division Administrator','Divisional administration'),
    ('DISTRICT_ADMIN',      'District Administrator','District administration'),
    ('CONSULTANT',          'Consultant',            'Prepares and submits project proposals'),
    ('SCRUTINY_OFFICER',    'Scrutiny Officer',      'Reviews project proposals'),
    ('FIELD_OFFICER',       'Field Verification Officer', 'Performs field surveys and verification'),
    ('COMPETENT_AUTHORITY', 'Competent Authority',   'Approves or rejects proposals and acquisition decisions'),
    ('FINANCE_OFFICER',     'Finance Officer',       'Valuation, compensation and payment tracking'),
    ('AUDITOR',             'Auditor',               'Read-only access for audit'),
    ('CITIZEN',             'Citizen',               'Public information user');

-- Interim permission matrix (write access for geographic roles arrives with geographic access control):
-- SUPER_ADMIN and CENTRAL_ADMIN get every permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN');

-- Every other internal role may read master data. CITIZEN gets nothing until public views exist.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'MASTER_DATA_READ'
WHERE r.code NOT IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'CITIZEN');

-- Auditors may also see who has access.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'USER_READ'
WHERE r.code = 'AUDITOR';
