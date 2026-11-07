-- V8: Module 4 (part 1) - acquisition cases, affected villages and parcels, owner snapshots, field surveys, history.
CREATE SEQUENCE acquisition_case_number_seq START 1;

CREATE TABLE acquisition_cases (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number    VARCHAR(30)   NOT NULL,
    project_id     UUID          NOT NULL REFERENCES projects (id),
    state_id       UUID          NOT NULL REFERENCES states (id),
    district_id    UUID          NOT NULL REFERENCES districts (id),
    framework      VARCHAR(40)   NOT NULL,
    framework_note VARCHAR(300),
    description    VARCHAR(1000),
    status         VARCHAR(30)   NOT NULL,
    row_version    BIGINT        NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by     VARCHAR(100),
    updated_by     VARCHAR(100),
    CONSTRAINT uq_cases_number UNIQUE (case_number),
    CONSTRAINT ck_cases_status CHECK (status IN ('INITIATED', 'SURVEY_IN_PROGRESS', 'VERIFICATION_COMPLETE',
        'NOTIFICATION_ISSUED', 'READY_FOR_AWARD', 'AWARD_DECLARED', 'POSSESSION_TAKEN', 'CLOSED', 'CANCELLED')),
    CONSTRAINT ck_cases_framework CHECK (framework IN ('LARR_2013', 'NATIONAL_HIGHWAYS_ACT_1956',
        'RAILWAYS_ACT_1989', 'STATE_ACT', 'OTHER'))
);
CREATE INDEX idx_cases_project  ON acquisition_cases (project_id);
CREATE INDEX idx_cases_district ON acquisition_cases (district_id);
CREATE INDEX idx_cases_status   ON acquisition_cases (status);

CREATE TABLE case_villages (
    case_id    UUID NOT NULL REFERENCES acquisition_cases (id),
    village_id UUID NOT NULL REFERENCES villages (id),
    PRIMARY KEY (case_id, village_id)
);

CREATE TABLE case_parcels (
    id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                   UUID          NOT NULL REFERENCES acquisition_cases (id),
    parcel_id                 UUID          NOT NULL REFERENCES land_parcels (id),
    village_id                UUID          NOT NULL REFERENCES villages (id),
    area_to_acquire_ha        NUMERIC(12,4) NOT NULL,
    assigned_surveyor_user_id UUID          REFERENCES users (id),
    identified_by             VARCHAR(100),
    identified_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    released_at               TIMESTAMPTZ,
    CONSTRAINT uq_case_parcel UNIQUE (case_id, parcel_id),
    CONSTRAINT ck_case_parcel_area CHECK (area_to_acquire_ha > 0)
);
-- a parcel can belong to only ONE open case at a time (released_at is set when a case is cancelled or closed)
CREATE UNIQUE INDEX uq_case_parcel_open ON case_parcels (parcel_id) WHERE released_at IS NULL;
CREATE INDEX idx_case_parcels_surveyor ON case_parcels (assigned_surveyor_user_id);

-- the owners and shares as they were on the day the parcel was identified (ids only, no personal data)
CREATE TABLE case_parcel_owners (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_parcel_id UUID         NOT NULL REFERENCES case_parcels (id),
    landowner_id   UUID         NOT NULL REFERENCES landowners (id),
    share_percent  NUMERIC(5,2) NOT NULL
);
CREATE INDEX idx_case_parcel_owners ON case_parcel_owners (case_parcel_id);

CREATE TABLE field_surveys (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id              UUID          NOT NULL REFERENCES acquisition_cases (id),
    case_parcel_id       UUID          NOT NULL REFERENCES case_parcels (id),
    surveyor_user_id     UUID          NOT NULL REFERENCES users (id),
    surveyor_username    VARCHAR(100)  NOT NULL,
    surveyed_on          DATE          NOT NULL,
    measured_area_ha     NUMERIC(12,4) NOT NULL,
    recorded_area_ha     NUMERIC(12,4) NOT NULL,
    variance_percent     NUMERIC(8,2)  NOT NULL,
    gps_latitude         NUMERIC(9,6)  NOT NULL,
    gps_longitude        NUMERIC(9,6)  NOT NULL,
    field_notes          VARCHAR(2000),
    status               VARCHAR(20)   NOT NULL,
    verified_by_user_id  UUID,
    verified_at          TIMESTAMPTZ,
    verification_remarks VARCHAR(500),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by           VARCHAR(100),
    CONSTRAINT ck_survey_status CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED')),
    CONSTRAINT ck_survey_area CHECK (measured_area_ha > 0),
    CONSTRAINT ck_survey_lat CHECK (gps_latitude BETWEEN -90 AND 90),
    CONSTRAINT ck_survey_lon CHECK (gps_longitude BETWEEN -180 AND 180)
);
-- at most one live (submitted or verified) survey per case parcel; a rejected one makes room for a new survey
CREATE UNIQUE INDEX uq_survey_live ON field_surveys (case_parcel_id) WHERE status IN ('SUBMITTED', 'VERIFIED');
CREATE INDEX idx_surveys_case ON field_surveys (case_id);

CREATE TABLE acquisition_case_history (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID          NOT NULL REFERENCES acquisition_cases (id),
    from_status    VARCHAR(30),
    to_status      VARCHAR(30)   NOT NULL,
    action         VARCHAR(40)   NOT NULL,
    actor_user_id  UUID,
    actor_username VARCHAR(100)  NOT NULL,
    reason         VARCHAR(1000),
    occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_history ON acquisition_case_history (case_id, occurred_at);
CREATE TRIGGER trg_case_history_append_only
    BEFORE UPDATE OR DELETE ON acquisition_case_history
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

INSERT INTO permissions (code, description) VALUES
    ('ACQUISITION_READ',   'View acquisition cases, affected parcels, surveys and reports within the geographic scope'),
    ('ACQUISITION_MANAGE', 'Create cases, identify villages and parcels, assign surveyors, move a case through survey stages'),
    ('SURVEY_PERFORM',     'Record field surveys for the parcels assigned to you'),
    ('SURVEY_VERIFY',      'Verify or reject a field survey (not your own)'),
    ('ACQUISITION_DECIDE', 'Take the legal decisions on a case (cancel; later award and closure)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ACQUISITION_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('ACQUISITION_MANAGE', 'SURVEY_VERIFY')
WHERE r.code = 'SCRUTINY_OFFICER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'SURVEY_PERFORM' WHERE r.code = 'FIELD_OFFICER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ACQUISITION_DECIDE' WHERE r.code = 'COMPETENT_AUTHORITY';