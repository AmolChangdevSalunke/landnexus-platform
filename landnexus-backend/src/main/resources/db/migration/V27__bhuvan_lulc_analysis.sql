-- V27: ISRO Bhuvan LULC AOI analysis history.
-- The provider token is never stored here. Only the AOI and the provider's answer are kept so a report can be
-- reproduced and exported later. Existing GIS permissions are reused; no new permission is introduced.
CREATE TABLE bhuvan_lulc_analyses (
    id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id             UUID          REFERENCES projects (id),
    project_code           VARCHAR(50),
    state_code             VARCHAR(10),
    state_name             VARCHAR(100),
    district_name          VARCHAR(100),
    aoi_source             VARCHAR(40)   NOT NULL,
    aoi_area_ha            NUMERIC(14,4),
    aoi_wkt                TEXT          NOT NULL,
    status                 VARCHAR(20)   NOT NULL,
    message                VARCHAR(500),
    record_count           INTEGER       NOT NULL DEFAULT 0,
    total_area_sq_km       NUMERIC(14,4),
    response_json          JSONB,
    requested_by_user_id   UUID          NOT NULL REFERENCES users (id),
    requested_by_username  VARCHAR(100)  NOT NULL,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_bhuvan_analysis_status CHECK (status IN ('SUCCESS', 'NO_DATA', 'FAILED')),
    CONSTRAINT ck_bhuvan_analysis_records CHECK (record_count >= 0)
);
CREATE INDEX idx_bhuvan_analysis_created ON bhuvan_lulc_analyses (created_at DESC);
CREATE INDEX idx_bhuvan_analysis_project ON bhuvan_lulc_analyses (project_id, created_at DESC);
