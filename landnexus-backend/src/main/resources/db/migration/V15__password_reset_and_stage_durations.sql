-- V15: one-time password reset codes (stored only as a SHA-256 hash) and the completed-stage durations used by the timeline forecast.
CREATE TABLE password_reset_tokens (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users (id),
    token_hash        VARCHAR(64) NOT NULL,
    issued_by_user_id UUID        NOT NULL REFERENCES users (id),
    issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    used_at           TIMESTAMPTZ,
    CONSTRAINT uq_reset_token_hash UNIQUE (token_hash)
);
CREATE INDEX idx_reset_tokens_user ON password_reset_tokens (user_id);

INSERT INTO permissions (code, description) VALUES
    ('PASSWORD_RESET_ISSUE', 'Issue a one-time password reset code for a user (shown once, valid 60 minutes)');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'PASSWORD_RESET_ISSUE' WHERE r.code = 'SUPER_ADMIN';

-- completed stages, named like the SLA item types, with how many hours they took (counts only: no personal data)
CREATE VIEW rpt_stage_durations AS
SELECT 'PROPOSAL_AWAITING_SCRUTINY'::text AS stage, pj.approved_at AS completed_at,
       GREATEST(0, extract(epoch FROM (pj.approved_at - pr.submitted_at)) / 3600.0)::numeric(14,2) AS hours
FROM projects pj JOIN proposals pr ON pr.id = pj.proposal_id
WHERE pj.approved_at IS NOT NULL AND pr.submitted_at IS NOT NULL
UNION ALL
SELECT 'DOCUMENT_AWAITING_VERIFICATION', d.verified_at,
       GREATEST(0, extract(epoch FROM (d.verified_at - v.uploaded_at)) / 3600.0)::numeric(14,2)
FROM land_documents d JOIN land_document_versions v ON v.document_id = d.id AND v.version_no = d.verified_version_no
WHERE d.verified_at IS NOT NULL
UNION ALL
SELECT 'SURVEY_AWAITING_VERIFICATION', fs.verified_at,
       GREATEST(0, extract(epoch FROM (fs.verified_at - fs.created_at)) / 3600.0)::numeric(14,2)
FROM field_surveys fs WHERE fs.verified_at IS NOT NULL
UNION ALL
SELECT 'OBJECTION_AWAITING_DECISION', o.decided_at,
       GREATEST(0, extract(epoch FROM (o.decided_at - o.created_at)) / 3600.0)::numeric(14,2)
FROM objections o WHERE o.decided_at IS NOT NULL
UNION ALL
SELECT 'ESTIMATE_AWAITING_APPROVAL', v.decided_at,
       GREATEST(0, extract(epoch FROM (v.decided_at - v.created_at)) / 3600.0)::numeric(14,2)
FROM valuations v WHERE v.decided_at IS NOT NULL AND v.status IN ('APPROVED', 'REJECTED')
UNION ALL
SELECT 'PAYMENT_AWAITING_RELEASE', cp.released_at,
       GREATEST(0, extract(epoch FROM (cp.released_at - cp.created_at)) / 3600.0)::numeric(14,2)
FROM compensation_payments cp WHERE cp.released_at IS NOT NULL
UNION ALL
SELECT 'PAYMENT_AWAITING_RESPONSE', cp.confirmed_at,
       GREATEST(0, extract(epoch FROM (cp.confirmed_at - cp.released_at)) / 3600.0)::numeric(14,2)
FROM compensation_payments cp WHERE cp.confirmed_at IS NOT NULL AND cp.released_at IS NOT NULL;