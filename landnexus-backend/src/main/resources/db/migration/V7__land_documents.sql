-- V7: Supporting documents with versions and manual verification.
-- Versions are append-only (function forbid_change_of_history comes from V4).

CREATE TABLE land_documents (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id            UUID         NOT NULL REFERENCES land_parcels (id),
    category             VARCHAR(30)  NOT NULL,
    title                VARCHAR(200) NOT NULL,
    current_version_no   INTEGER      NOT NULL,
    verification_status  VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    verified_version_no  INTEGER,
    verified_by_user_id  UUID,
    verified_at          TIMESTAMPTZ,
    verification_remarks VARCHAR(500),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    CONSTRAINT ck_docs_category CHECK (category IN ('SEVEN_TWELVE_EXTRACT', 'EIGHT_A_EXTRACT', 'MUTATION_ENTRY',
        'SALE_DEED', 'SURVEY_MAP', 'NOTICE', 'OTHER')),
    CONSTRAINT ck_docs_status CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'))
);
CREATE INDEX idx_docs_parcel ON land_documents (parcel_id);

CREATE TABLE land_document_versions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID         NOT NULL REFERENCES land_documents (id),
    version_no          INTEGER      NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    stored_key          VARCHAR(120) NOT NULL,
    content_type        VARCHAR(100) NOT NULL,
    size_bytes          BIGINT       NOT NULL,
    sha256              VARCHAR(64)  NOT NULL,
    uploaded_by_user_id UUID,
    uploaded_by_username VARCHAR(100) NOT NULL,
    uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_version UNIQUE (document_id, version_no),
    CONSTRAINT ck_doc_size CHECK (size_bytes > 0)
);

CREATE TRIGGER trg_land_document_versions_append_only
    BEFORE UPDATE OR DELETE ON land_document_versions
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

INSERT INTO permissions (code, description) VALUES
    ('DOCUMENT_READ',   'View and download parcel documents within the geographic scope (every download is audited)'),
    ('DOCUMENT_UPLOAD', 'Upload documents and new versions'),
    ('DOCUMENT_VERIFY', 'Manually verify or reject a document (not the one who uploaded it)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'DOCUMENT_READ'
WHERE r.code IN ('SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'DOCUMENT_UPLOAD'
WHERE r.code IN ('FIELD_OFFICER', 'SCRUTINY_OFFICER');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'DOCUMENT_VERIFY'
WHERE r.code = 'SCRUTINY_OFFICER';