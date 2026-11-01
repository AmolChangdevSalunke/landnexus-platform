-- V2: Administration module - ministries, departments and administrative geography.
-- Master records are deactivated (status), never deleted, so history stays intact.
-- Village/district boundary geometry is added later by the GIS module (separate migration).

CREATE TABLE ministries (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_ministries_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_ministries_code UNIQUE (code)
);

CREATE TABLE departments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    ministry_id UUID         NOT NULL REFERENCES ministries (id),
    level       VARCHAR(20)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_departments_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_departments_code UNIQUE (code),
    CONSTRAINT ck_departments_level CHECK (level IN ('CENTRAL', 'STATE', 'DIVISION', 'DISTRICT'))
);

CREATE TABLE states (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_states_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_states_code UNIQUE (code)
);

CREATE TABLE divisions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    state_id    UUID         NOT NULL REFERENCES states (id),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_divisions_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_divisions_state_code UNIQUE (state_id, code)
);

CREATE TABLE districts (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    state_id    UUID         NOT NULL REFERENCES states (id),
    division_id UUID         REFERENCES divisions (id),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_districts_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_districts_state_code UNIQUE (state_id, code)
);

CREATE TABLE talukas (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    district_id UUID         NOT NULL REFERENCES districts (id),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_talukas_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_talukas_district_code UNIQUE (district_id, code)
);

CREATE TABLE villages (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(150) NOT NULL,
    taluka_id   UUID         NOT NULL REFERENCES talukas (id),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    CONSTRAINT ck_villages_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_villages_taluka_code UNIQUE (taluka_id, code)
);

-- Indexes on foreign keys (used by the "filter by parent" list endpoints) and name search/sorting.
CREATE INDEX idx_departments_ministry ON departments (ministry_id);
CREATE INDEX idx_divisions_state      ON divisions (state_id);
CREATE INDEX idx_districts_state      ON districts (state_id);
CREATE INDEX idx_districts_division   ON districts (division_id);
CREATE INDEX idx_talukas_district     ON talukas (district_id);
CREATE INDEX idx_villages_taluka      ON villages (taluka_id);
CREATE INDEX idx_villages_name        ON villages (name);
