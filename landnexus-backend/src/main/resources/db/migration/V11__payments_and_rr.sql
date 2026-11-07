-- V11: Module 5 (part 2) - SIMULATED payments and R&R. No bank details are stored. The mode can only be SIMULATED.
CREATE TABLE compensation_payments (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    valuation_id        UUID          NOT NULL REFERENCES valuations (id),
    case_id             UUID          NOT NULL REFERENCES acquisition_cases (id),
    case_parcel_id      UUID          NOT NULL REFERENCES case_parcels (id),
    landowner_id        UUID          NOT NULL REFERENCES landowners (id),
    share_percent       NUMERIC(5,2)  NOT NULL,
    amount              NUMERIC(15,2) NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    mode                VARCHAR(20)   NOT NULL DEFAULT 'SIMULATED',
    reference           VARCHAR(60),
    failure_reason      VARCHAR(500),
    attempt_count       INTEGER       NOT NULL DEFAULT 0,
    released_by_user_id UUID          REFERENCES users (id),
    released_at         TIMESTAMPTZ,
    confirmed_at        TIMESTAMPTZ,
    row_version         BIGINT        NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_payment_owner UNIQUE (valuation_id, landowner_id),
    CONSTRAINT ck_payment_amount CHECK (amount >= 0),
    CONSTRAINT ck_payment_status CHECK (status IN ('INSTRUCTED', 'SENT', 'CONFIRMED', 'FAILED')),
    CONSTRAINT ck_payment_mode CHECK (mode = 'SIMULATED')
);
CREATE INDEX idx_payments_case ON compensation_payments (case_id);

CREATE TABLE payment_events (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id     UUID         NOT NULL REFERENCES compensation_payments (id),
    from_status    VARCHAR(20),
    to_status      VARCHAR(20)  NOT NULL,
    event          VARCHAR(30)  NOT NULL,
    actor_user_id  UUID,
    actor_username VARCHAR(100) NOT NULL,
    detail         VARCHAR(300),
    occurred_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_events ON payment_events (payment_id, occurred_at);
CREATE TRIGGER trg_payment_events_append_only
    BEFORE UPDATE OR DELETE ON payment_events
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

CREATE TABLE rr_benefit_types (
    id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                     VARCHAR(40)   NOT NULL,
    name                     VARCHAR(100)  NOT NULL,
    kind                     VARCHAR(20)   NOT NULL,
    default_amount           NUMERIC(15,2),
    default_months           INTEGER,
    requires_displaced       BOOLEAN       NOT NULL DEFAULT FALSE,
    requires_livelihood_lost BOOLEAN       NOT NULL DEFAULT FALSE,
    active                   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by               VARCHAR(100),
    CONSTRAINT uq_rr_benefit_code UNIQUE (code),
    CONSTRAINT ck_rr_benefit_kind CHECK (kind IN ('ONE_TIME_CASH', 'MONTHLY_ALLOWANCE', 'HOUSING', 'EMPLOYMENT', 'OTHER'))
);

CREATE TABLE rr_cases (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID         NOT NULL REFERENCES acquisition_cases (id),
    landowner_id        UUID         NOT NULL REFERENCES landowners (id),
    displaced           BOOLEAN      NOT NULL,
    livelihood_lost     BOOLEAN      NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    notes               VARCHAR(500),
    created_by_user_id  UUID         NOT NULL REFERENCES users (id),
    approved_by_user_id UUID         REFERENCES users (id),
    decided_at          TIMESTAMPTZ,
    row_version         BIGINT       NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_rr_case_owner UNIQUE (case_id, landowner_id),
    CONSTRAINT ck_rr_case_status CHECK (status IN ('IDENTIFIED', 'ASSESSED', 'APPROVED', 'COMPLETED'))
);

CREATE TABLE rr_entitlements (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    rr_case_id       UUID          NOT NULL REFERENCES rr_cases (id),
    benefit_type_id  UUID          NOT NULL REFERENCES rr_benefit_types (id),
    benefit_code     VARCHAR(40)   NOT NULL,
    benefit_name     VARCHAR(100)  NOT NULL,
    kind             VARCHAR(20)   NOT NULL,
    amount           NUMERIC(15,2),
    months           INTEGER,
    status           VARCHAR(20)   NOT NULL DEFAULT 'PLANNED',
    delivered_on     DATE,
    delivery_remarks VARCHAR(500),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_rr_entitlement UNIQUE (rr_case_id, benefit_type_id),
    CONSTRAINT ck_rr_entitlement_status CHECK (status IN ('PLANNED', 'DELIVERED'))
);

INSERT INTO permissions (code, description) VALUES
    ('PAYMENT_READ',    'View payment instructions and their history within the geographic scope'),
    ('PAYMENT_RELEASE', 'Generate, release and (in simulation) answer payments; not the preparer or approver of the estimate'),
    ('RR_READ',         'View R&R cases and entitlements within the geographic scope'),
    ('RR_MANAGE',       'Identify R&R cases, assess entitlements, record deliveries'),
    ('RR_APPROVE',      'Approve an R&R assessment (not the one who identified the case)'),
    ('RR_CATALOGUE',    'Maintain the catalogue of R&R benefit types');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'PAYMENT_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'PAYMENT_RELEASE' WHERE r.code = 'FINANCE_OFFICER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RR_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RR_MANAGE' WHERE r.code IN ('SCRUTINY_OFFICER', 'FIELD_OFFICER');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RR_APPROVE' WHERE r.code = 'COMPETENT_AUTHORITY';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'RR_CATALOGUE' WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN');