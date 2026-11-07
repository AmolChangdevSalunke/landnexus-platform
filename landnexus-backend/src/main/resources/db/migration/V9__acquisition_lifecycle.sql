-- V9: Module 4 (part 2) - legal notices, objections, award, possession, geo-tagged survey photos.
CREATE TABLE legal_notices (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id            UUID          NOT NULL REFERENCES acquisition_cases (id),
    notice_type        VARCHAR(30)   NOT NULL,
    reference_number   VARCHAR(60)   NOT NULL,
    issued_on          DATE          NOT NULL,
    objection_deadline DATE,
    description        VARCHAR(1000),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         VARCHAR(100),
    CONSTRAINT uq_notice_ref UNIQUE (case_id, reference_number),
    CONSTRAINT ck_notice_type CHECK (notice_type IN ('PRELIMINARY_NOTIFICATION', 'FINAL_DECLARATION',
        'AWARD_NOTICE', 'POSSESSION_NOTICE', 'OTHER')),
    CONSTRAINT ck_notice_deadline CHECK (objection_deadline IS NULL OR objection_deadline >= issued_on)
);

CREATE TABLE objections (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id              UUID          NOT NULL REFERENCES acquisition_cases (id),
    case_parcel_id       UUID          NOT NULL REFERENCES case_parcels (id),
    objection_number     VARCHAR(20)   NOT NULL,
    received_on          DATE          NOT NULL,
    grounds              VARCHAR(2000) NOT NULL,
    objector_reference   VARCHAR(200),
    status               VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    registered_by_user_id UUID         NOT NULL REFERENCES users (id),
    decided_by_user_id   UUID,
    decided_at           TIMESTAMPTZ,
    decision_remarks     VARCHAR(1000),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by           VARCHAR(100),
    CONSTRAINT uq_objection_number UNIQUE (case_id, objection_number),
    CONSTRAINT ck_objection_status CHECK (status IN ('OPEN', 'ACCEPTED', 'DISMISSED'))
);
CREATE INDEX idx_objections_case ON objections (case_id);

CREATE TABLE acquisition_awards (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID         NOT NULL REFERENCES acquisition_cases (id),
    award_number        VARCHAR(40)  NOT NULL,
    award_date          DATE         NOT NULL,
    remarks             VARCHAR(1000),
    declared_by_user_id UUID         NOT NULL REFERENCES users (id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_award_case UNIQUE (case_id)
);

-- one line per affected parcel; Module 5 (compensation) will attach amounts to these lines
CREATE TABLE award_parcels (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id        UUID          NOT NULL REFERENCES acquisition_awards (id),
    case_parcel_id  UUID          NOT NULL REFERENCES case_parcels (id),
    awarded_area_ha NUMERIC(12,4) NOT NULL,
    CONSTRAINT uq_award_parcel UNIQUE (award_id, case_parcel_id),
    CONSTRAINT ck_award_area CHECK (awarded_area_ha > 0)
);

CREATE TABLE possession_records (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID         NOT NULL REFERENCES acquisition_cases (id),
    case_parcel_id      UUID         NOT NULL REFERENCES case_parcels (id),
    possession_date     DATE         NOT NULL,
    possession_type     VARCHAR(20)  NOT NULL,
    remarks             VARCHAR(500),
    recorded_by_user_id UUID         NOT NULL REFERENCES users (id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_possession_parcel UNIQUE (case_parcel_id),
    CONSTRAINT ck_possession_type CHECK (possession_type IN ('PHYSICAL', 'DEEMED'))
);

CREATE TABLE survey_photos (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id            UUID          NOT NULL REFERENCES field_surveys (id),
    original_filename    VARCHAR(255)  NOT NULL,
    stored_key           VARCHAR(120)  NOT NULL,
    content_type         VARCHAR(100)  NOT NULL,
    size_bytes           BIGINT        NOT NULL,
    sha256               VARCHAR(64)   NOT NULL,
    gps_latitude         NUMERIC(9,6)  NOT NULL,
    gps_longitude        NUMERIC(9,6)  NOT NULL,
    captured_at          TIMESTAMPTZ,
    uploaded_by_user_id  UUID          NOT NULL REFERENCES users (id),
    uploaded_by_username VARCHAR(100)  NOT NULL,
    uploaded_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_survey ON survey_photos (survey_id);
CREATE TRIGGER trg_survey_photos_append_only
    BEFORE UPDATE OR DELETE ON survey_photos
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();