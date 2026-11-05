-- V6: Land records core - parcels, landowners, ownership, mutations, 7/12 and 8A records.
-- Geography is referenced by id; landowner data is sensitive personal data (no government ID numbers).

CREATE TABLE land_parcels (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id           UUID          NOT NULL REFERENCES states (id),
    district_id        UUID          NOT NULL REFERENCES districts (id),
    taluka_id          UUID          NOT NULL REFERENCES talukas (id),
    village_id         UUID          NOT NULL REFERENCES villages (id),
    gat_number         VARCHAR(30),
    survey_number      VARCHAR(30),
    subdivision_number VARCHAR(30),
    parcel_key         VARCHAR(100)  NOT NULL,
    area_ha            NUMERIC(12,4) NOT NULL,
    classification     VARCHAR(40)   NOT NULL,
    land_use           VARCHAR(40)   NOT NULL,
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    row_version        BIGINT        NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    CONSTRAINT uq_parcels_village_key UNIQUE (village_id, parcel_key),
    CONSTRAINT ck_parcels_identifier CHECK (gat_number IS NOT NULL OR survey_number IS NOT NULL),
    CONSTRAINT ck_parcels_area CHECK (area_ha > 0),
    CONSTRAINT ck_parcels_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_parcels_class CHECK (classification IN ('AGRICULTURAL_IRRIGATED', 'AGRICULTURAL_DRY',
        'NON_AGRICULTURAL', 'FOREST', 'GOVERNMENT', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'WASTE_LAND', 'OTHER')),
    CONSTRAINT ck_parcels_use CHECK (land_use IN ('CULTIVATION', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL',
        'ROAD', 'WATER_BODY', 'VACANT', 'OTHER'))
);
CREATE INDEX idx_parcels_district ON land_parcels (district_id);
CREATE INDEX idx_parcels_village  ON land_parcels (village_id);

CREATE TABLE landowners (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id   UUID         NOT NULL REFERENCES districts (id),
    owner_type    VARCHAR(20)  NOT NULL,
    full_name     VARCHAR(200) NOT NULL,
    guardian_name VARCHAR(200),
    address       VARCHAR(500),
    phone         VARCHAR(20),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100),
    CONSTRAINT ck_landowners_type CHECK (owner_type IN ('INDIVIDUAL', 'GOVERNMENT', 'INSTITUTION'))
);
CREATE INDEX idx_landowners_district ON landowners (district_id);
CREATE INDEX idx_landowners_name     ON landowners (full_name);

CREATE TABLE parcel_ownerships (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id     UUID         NOT NULL REFERENCES land_parcels (id),
    landowner_id  UUID         NOT NULL REFERENCES landowners (id),
    share_percent NUMERIC(5,2) NOT NULL,
    basis         VARCHAR(20)  NOT NULL,
    from_date     DATE         NOT NULL,
    to_date       DATE,
    remarks       VARCHAR(500),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    VARCHAR(100),
    CONSTRAINT ck_ownership_share CHECK (share_percent > 0 AND share_percent <= 100),
    CONSTRAINT ck_ownership_dates CHECK (to_date IS NULL OR to_date >= from_date),
    CONSTRAINT ck_ownership_basis CHECK (basis IN ('ORIGINAL', 'INHERITANCE', 'SALE', 'GIFT', 'PARTITION',
        'COURT_ORDER', 'OTHER'))
);
-- one current ownership per owner per parcel, guaranteed by the database itself
CREATE UNIQUE INDEX uq_parcel_ownership_current ON parcel_ownerships (parcel_id, landowner_id) WHERE to_date IS NULL;
CREATE INDEX idx_ownership_parcel ON parcel_ownerships (parcel_id);

CREATE TABLE parcel_mutations (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id       UUID          NOT NULL REFERENCES land_parcels (id),
    mutation_number VARCHAR(30)   NOT NULL,
    mutation_date   DATE          NOT NULL,
    mutation_type   VARCHAR(20)   NOT NULL,
    description     VARCHAR(1000),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      VARCHAR(100),
    CONSTRAINT uq_mutation_number UNIQUE (parcel_id, mutation_number),
    CONSTRAINT ck_mutation_type CHECK (mutation_type IN ('SALE', 'INHERITANCE', 'GIFT', 'PARTITION',
        'MORTGAGE', 'COURT_ORDER', 'OTHER'))
);

CREATE TABLE revenue_records (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id    UUID          NOT NULL REFERENCES land_parcels (id),
    record_type  VARCHAR(20)   NOT NULL,
    extract_date DATE          NOT NULL,
    khata_number VARCHAR(30),
    particulars  VARCHAR(2000) NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by   VARCHAR(100),
    CONSTRAINT uq_revenue_record UNIQUE (parcel_id, record_type, extract_date),
    CONSTRAINT ck_revenue_type CHECK (record_type IN ('SEVEN_TWELVE', 'EIGHT_A')),
    CONSTRAINT ck_revenue_khata CHECK (record_type = 'SEVEN_TWELVE' OR khata_number IS NOT NULL)
);

INSERT INTO permissions (code, description) VALUES
    ('LAND_RECORD_READ',  'View parcels, ownership shares, mutations and 7/12, 8A records within the geographic scope'),
    ('LAND_RECORD_WRITE', 'Create and change parcels, landowners, ownership, mutations and 7/12, 8A records'),
    ('LANDOWNER_READ',    'See landowner personal data (name, address, phone); every view is audited');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'LAND_RECORD_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'LAND_RECORD_WRITE'
WHERE r.code IN ('FIELD_OFFICER', 'SCRUTINY_OFFICER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'LANDOWNER_READ'
WHERE r.code IN ('SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY');