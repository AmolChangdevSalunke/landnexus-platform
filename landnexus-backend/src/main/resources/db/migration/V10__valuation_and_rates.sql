-- V10: Module 5 (part 1) - market value rates, versioned rule sets, asset records, valuations.
CREATE TABLE market_value_rates (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id        UUID          NOT NULL REFERENCES villages (id),
    district_id       UUID          NOT NULL REFERENCES districts (id),
    classification    VARCHAR(40)   NOT NULL,
    rate_per_ha       NUMERIC(15,2) NOT NULL,
    effective_from    DATE          NOT NULL,
    source_note       VARCHAR(200),
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    created_by_user_id UUID         NOT NULL REFERENCES users (id),
    approved_by_user_id UUID        REFERENCES users (id),
    decided_at        TIMESTAMPTZ,
    decision_remarks  VARCHAR(500),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by        VARCHAR(100),
    CONSTRAINT ck_rate_value CHECK (rate_per_ha > 0),
    CONSTRAINT ck_rate_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);
CREATE UNIQUE INDEX uq_rate_live ON market_value_rates (village_id, classification, effective_from) WHERE status <> 'REJECTED';
CREATE INDEX idx_rates_district ON market_value_rates (district_id);

CREATE TABLE valuation_rule_sets (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    version             INTEGER      NOT NULL,
    framework           VARCHAR(40)  NOT NULL,
    state_id            UUID         REFERENCES states (id),
    district_id         UUID         REFERENCES districts (id),
    effective_from      DATE         NOT NULL,
    effective_to        DATE,
    description         VARCHAR(500),
    status              VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    created_by_user_id  UUID         NOT NULL REFERENCES users (id),
    approved_by_user_id UUID         REFERENCES users (id),
    approved_at         TIMESTAMPTZ,
    retire_reason       VARCHAR(500),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_rule_set_version UNIQUE (name, version),
    CONSTRAINT ck_rule_set_status CHECK (status IN ('DRAFT', 'APPROVED', 'RETIRED')),
    CONSTRAINT ck_rule_set_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- components never change once written: a different rule is a new version of the rule set
CREATE TABLE rule_set_components (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id UUID          NOT NULL REFERENCES valuation_rule_sets (id),
    position    INTEGER       NOT NULL,
    code        VARCHAR(40)   NOT NULL,
    name        VARCHAR(100)  NOT NULL,
    type        VARCHAR(30)   NOT NULL,
    factor      NUMERIC(15,6) NOT NULL,
    base_codes  VARCHAR(300),
    CONSTRAINT uq_component_code UNIQUE (rule_set_id, code),
    CONSTRAINT uq_component_position UNIQUE (rule_set_id, position),
    CONSTRAINT ck_component_type CHECK (type IN ('LAND_VALUE', 'ASSET_VALUE', 'PERCENT_OF', 'FIXED_PER_HECTARE'))
);
CREATE TRIGGER trg_rule_set_components_append_only
    BEFORE UPDATE OR DELETE ON rule_set_components
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TABLE asset_records (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_parcel_id      UUID          NOT NULL REFERENCES case_parcels (id),
    category            VARCHAR(20)   NOT NULL,
    description         VARCHAR(200)  NOT NULL,
    quantity            NUMERIC(12,3) NOT NULL,
    unit                VARCHAR(20)   NOT NULL,
    unit_value          NUMERIC(15,2) NOT NULL,
    value               NUMERIC(15,2) NOT NULL,
    voided              BOOLEAN       NOT NULL DEFAULT FALSE,
    void_reason         VARCHAR(500),
    entered_by_user_id  UUID          NOT NULL REFERENCES users (id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT ck_asset_category CHECK (category IN ('BUILDING', 'TREE', 'WELL', 'CROP', 'OTHER')),
    CONSTRAINT ck_asset_qty CHECK (quantity > 0 AND unit_value > 0)
);
CREATE INDEX idx_assets_case_parcel ON asset_records (case_parcel_id);

CREATE TABLE valuations (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id              UUID          NOT NULL REFERENCES acquisition_cases (id),
    case_parcel_id       UUID          NOT NULL REFERENCES case_parcels (id),
    parcel_id            UUID          NOT NULL REFERENCES land_parcels (id),
    version_no           INTEGER       NOT NULL,
    awarded_area_ha      NUMERIC(12,4) NOT NULL,
    classification       VARCHAR(40)   NOT NULL,
    rate_id              UUID          NOT NULL REFERENCES market_value_rates (id),
    rate_per_ha          NUMERIC(15,2) NOT NULL,
    rule_set_id          UUID          NOT NULL REFERENCES valuation_rule_sets (id),
    rule_set_name        VARCHAR(100)  NOT NULL,
    rule_set_version     INTEGER       NOT NULL,
    reference_date       DATE          NOT NULL,
    asset_total          NUMERIC(15,2) NOT NULL,
    total_amount         NUMERIC(15,2) NOT NULL,
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    prepared_by_user_id  UUID          NOT NULL REFERENCES users (id),
    prepared_by_username VARCHAR(100)  NOT NULL,
    decided_by_user_id   UUID          REFERENCES users (id),
    decided_at           TIMESTAMPTZ,
    decision_remarks     VARCHAR(1000),
    row_version          BIGINT        NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by           VARCHAR(100),
    CONSTRAINT uq_valuation_version UNIQUE (case_parcel_id, version_no),
    CONSTRAINT ck_valuation_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED'))
);
-- at most one live estimate per awarded parcel; rejected and superseded ones are history
CREATE UNIQUE INDEX uq_valuation_live ON valuations (case_parcel_id) WHERE status IN ('DRAFT', 'SUBMITTED', 'APPROVED');
CREATE INDEX idx_valuations_case ON valuations (case_id);

CREATE TABLE valuation_lines (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    valuation_id   UUID          NOT NULL REFERENCES valuations (id),
    position       INTEGER       NOT NULL,
    component_code VARCHAR(40)   NOT NULL,
    component_name VARCHAR(100)  NOT NULL,
    component_type VARCHAR(30)   NOT NULL,
    basis          VARCHAR(300)  NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    CONSTRAINT uq_valuation_line UNIQUE (valuation_id, position)
);

INSERT INTO permissions (code, description) VALUES
    ('RULESET_MANAGE',    'Draft and retire valuation rule sets'),
    ('RULESET_APPROVE',   'Approve a rule set (not the one who drafted it)'),
    ('RATE_MANAGE',       'Enter market value rates within the geographic scope'),
    ('RATE_APPROVE',      'Approve a market value rate (not the one who entered it)'),
    ('VALUATION_READ',    'View rates, rule sets, estimates and the compensation summary within the scope'),
    ('VALUATION_MANAGE',  'Record assets, compute and submit compensation estimates'),
    ('VALUATION_APPROVE', 'Approve or reject a submitted estimate (not the one who prepared it)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('RULESET_MANAGE', 'RULESET_APPROVE')
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RATE_MANAGE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'STATE_ADMIN', 'DISTRICT_ADMIN');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RATE_APPROVE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'STATE_ADMIN');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'VALUATION_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'VALUATION_MANAGE' WHERE r.code = 'SCRUTINY_OFFICER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'VALUATION_APPROVE' WHERE r.code = 'COMPETENT_AUTHORITY';