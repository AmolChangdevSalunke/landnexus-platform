-- V12: Module 6 (part 1) - parcel boundaries and project alignments as PostGIS geometry (SRID 4326, WGS84).
-- Geometry is entered by officers as GeoJSON; nothing is generated or fetched. Versions are kept; rows are never deleted.
CREATE TABLE parcel_boundaries (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id            UUID         NOT NULL REFERENCES land_parcels (id),
    version_no           INTEGER      NOT NULL,
    geom                 geometry(MultiPolygon, 4326) NOT NULL,
    area_ha              NUMERIC(14,4) NOT NULL,
    vertices             INTEGER      NOT NULL,
    source_note          VARCHAR(200),
    entered_by_user_id   UUID         NOT NULL REFERENCES users (id),
    entered_by_username  VARCHAR(100) NOT NULL,
    entered_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    superseded_at        TIMESTAMPTZ,
    CONSTRAINT uq_boundary_version UNIQUE (parcel_id, version_no),
    CONSTRAINT ck_boundary_area CHECK (area_ha > 0)
);
CREATE UNIQUE INDEX uq_boundary_current ON parcel_boundaries (parcel_id) WHERE superseded_at IS NULL;
CREATE INDEX idx_boundary_geom ON parcel_boundaries USING GIST (geom);

CREATE TABLE project_alignments (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID         NOT NULL REFERENCES projects (id),
    version_no           INTEGER      NOT NULL,
    geom                 geometry(MultiLineString, 4326) NOT NULL,
    length_km            NUMERIC(12,3) NOT NULL,
    corridor_width_m     INTEGER      NOT NULL,
    vertices             INTEGER      NOT NULL,
    source_note          VARCHAR(200),
    entered_by_user_id   UUID         NOT NULL REFERENCES users (id),
    entered_by_username  VARCHAR(100) NOT NULL,
    entered_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    superseded_at        TIMESTAMPTZ,
    CONSTRAINT uq_alignment_version UNIQUE (project_id, version_no),
    CONSTRAINT ck_alignment_length CHECK (length_km > 0),
    CONSTRAINT ck_alignment_width CHECK (corridor_width_m BETWEEN 1 AND 1000)
);
CREATE UNIQUE INDEX uq_alignment_current ON project_alignments (project_id) WHERE superseded_at IS NULL;
CREATE INDEX idx_alignment_geom ON project_alignments USING GIST (geom);

CREATE FUNCTION forbid_delete_of_gis() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% rows cannot be deleted: a new version replaces the old one', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parcel_boundaries_no_delete BEFORE DELETE ON parcel_boundaries
    FOR EACH ROW EXECUTE FUNCTION forbid_delete_of_gis();
CREATE TRIGGER trg_project_alignments_no_delete BEFORE DELETE ON project_alignments
    FOR EACH ROW EXECUTE FUNCTION forbid_delete_of_gis();

INSERT INTO permissions (code, description) VALUES
    ('GIS_READ',  'View parcel boundaries, project alignments and map layers within the geographic scope'),
    ('GIS_WRITE', 'Enter parcel boundaries and project alignments as GeoJSON');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'GIS_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'GIS_WRITE'
WHERE r.code IN ('FIELD_OFFICER', 'SCRUTINY_OFFICER');