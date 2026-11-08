-- V14: Module 7 (part 2) - SLA rules, the list of things people are waiting on, and the escalation log.
-- Escalation only sends in-app notifications; no status is ever changed automatically.
-- The default limits below are DEMO values for illustration, not official policy: an administrator sets the real ones.
CREATE VIEW rpt_sla_items AS
SELECT 'PROPOSAL_AWAITING_SCRUTINY'::text AS item_type, p.id AS entity_id, p.proposal_number::text AS reference,
       p.state_id AS state_id, p.district_id AS district_id, p.submitted_at AS since
FROM proposals p WHERE p.status = 'SUBMITTED' AND p.submitted_at IS NOT NULL
UNION ALL
SELECT 'DOCUMENT_AWAITING_VERIFICATION'::text, d.id, (COALESCE(pc.gat_number, pc.survey_number) || ' / ' || d.category)::text,
       pc.state_id, pc.district_id, d.updated_at
FROM land_documents d JOIN land_parcels pc ON pc.id = d.parcel_id
WHERE d.verification_status = 'PENDING'
UNION ALL
SELECT 'SURVEY_AWAITING_VERIFICATION'::text, fs.id, c.case_number::text, c.state_id, c.district_id, fs.created_at
FROM field_surveys fs JOIN acquisition_cases c ON c.id = fs.case_id
WHERE fs.status = 'SUBMITTED' AND c.status = 'SURVEY_IN_PROGRESS'
UNION ALL
SELECT 'OBJECTION_AWAITING_DECISION'::text, o.id, (c.case_number || ' ' || o.objection_number)::text, c.state_id, c.district_id, o.created_at
FROM objections o JOIN acquisition_cases c ON c.id = o.case_id
WHERE o.status = 'OPEN' AND c.status = 'NOTIFICATION_ISSUED'
UNION ALL
SELECT 'OBJECTION_WINDOW_NOT_CLOSED'::text, c.id, c.case_number::text, c.state_id, c.district_id,
       ((n.deadline + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
FROM acquisition_cases c
JOIN (SELECT case_id, MAX(objection_deadline) AS deadline FROM legal_notices
      WHERE notice_type = 'PRELIMINARY_NOTIFICATION' GROUP BY case_id) n ON n.case_id = c.id
WHERE c.status = 'NOTIFICATION_ISSUED' AND n.deadline IS NOT NULL
  AND n.deadline < (now() AT TIME ZONE 'Asia/Kolkata')::date
  AND NOT EXISTS (SELECT 1 FROM objections o WHERE o.case_id = c.id AND o.status = 'OPEN')
UNION ALL
SELECT 'ESTIMATE_AWAITING_APPROVAL'::text, v.id, c.case_number::text, c.state_id, c.district_id, v.created_at
FROM valuations v JOIN acquisition_cases c ON c.id = v.case_id
WHERE v.status = 'SUBMITTED'
UNION ALL
SELECT 'PAYMENT_AWAITING_RELEASE'::text, cp.id, c.case_number::text, c.state_id, c.district_id, cp.created_at
FROM compensation_payments cp JOIN acquisition_cases c ON c.id = cp.case_id
WHERE cp.status = 'INSTRUCTED'
UNION ALL
SELECT 'PAYMENT_AWAITING_RESPONSE'::text, cp.id, c.case_number::text, c.state_id, c.district_id, cp.released_at
FROM compensation_payments cp JOIN acquisition_cases c ON c.id = cp.case_id
WHERE cp.status = 'SENT' AND cp.released_at IS NOT NULL;

CREATE TABLE sla_rules (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type          VARCHAR(40)  NOT NULL,
    title              VARCHAR(100) NOT NULL,
    warn_after_hours   INTEGER      NOT NULL,
    breach_after_hours INTEGER      NOT NULL,
    responsible_role   VARCHAR(40)  NOT NULL,
    escalate_role      VARCHAR(40),
    active             BOOLEAN      NOT NULL DEFAULT TRUE,
    note               VARCHAR(300),
    row_version        BIGINT       NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sla_rule_type UNIQUE (item_type),
    CONSTRAINT ck_sla_rule_type CHECK (item_type IN ('PROPOSAL_AWAITING_SCRUTINY', 'DOCUMENT_AWAITING_VERIFICATION',
        'SURVEY_AWAITING_VERIFICATION', 'OBJECTION_AWAITING_DECISION', 'OBJECTION_WINDOW_NOT_CLOSED',
        'ESTIMATE_AWAITING_APPROVAL', 'PAYMENT_AWAITING_RELEASE', 'PAYMENT_AWAITING_RESPONSE')),
    CONSTRAINT ck_sla_rule_hours CHECK (warn_after_hours >= 0 AND breach_after_hours > warn_after_hours AND breach_after_hours <= 8760)
);

INSERT INTO sla_rules (item_type, title, warn_after_hours, breach_after_hours, responsible_role, escalate_role, note) VALUES
    ('PROPOSAL_AWAITING_SCRUTINY',   'Proposal waiting for scrutiny',                  120, 240, 'SCRUTINY_OFFICER',   'COMPETENT_AUTHORITY', 'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('DOCUMENT_AWAITING_VERIFICATION','Document waiting for verification',               72, 168, 'SCRUTINY_OFFICER',   'COMPETENT_AUTHORITY', 'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('SURVEY_AWAITING_VERIFICATION', 'Field survey waiting for verification',            72, 168, 'SCRUTINY_OFFICER',   'COMPETENT_AUTHORITY', 'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('OBJECTION_AWAITING_DECISION',  'Objection waiting for a decision',                168, 336, 'COMPETENT_AUTHORITY','DISTRICT_ADMIN',      'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('OBJECTION_WINDOW_NOT_CLOSED',  'Objection period is over but the window is not closed', 24, 72, 'SCRUTINY_OFFICER', 'COMPETENT_AUTHORITY', 'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('ESTIMATE_AWAITING_APPROVAL',   'Compensation estimate waiting for approval',      120, 240, 'COMPETENT_AUTHORITY','DISTRICT_ADMIN',      'DEMO default; time counted from when the estimate was calculated'),
    ('PAYMENT_AWAITING_RELEASE',     'Payment waiting for release (simulated)',          72, 168, 'FINANCE_OFFICER',    'DISTRICT_ADMIN',      'DEMO default for illustration, not official policy: set the real limits in System settings'),
    ('PAYMENT_AWAITING_RESPONSE',    'Payment sent, waiting for the answer (simulated)', 48, 120, 'FINANCE_OFFICER',    'DISTRICT_ADMIN',      'DEMO default for illustration, not official policy: set the real limits in System settings');

-- one row per item, per level, per waiting period: this is what stops the same alert being sent twice
CREATE TABLE sla_escalations (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type        VARCHAR(40)  NOT NULL,
    entity_id        UUID         NOT NULL,
    since            TIMESTAMPTZ  NOT NULL,
    sla_level        VARCHAR(10)  NOT NULL,
    reference        VARCHAR(120) NOT NULL,
    state_id         UUID,
    district_id      UUID         NOT NULL,
    responsible_role VARCHAR(40)  NOT NULL,
    escalate_role    VARCHAR(40),
    threshold_hours  INTEGER      NOT NULL,
    triggered_by     VARCHAR(100) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sla_escalation UNIQUE (item_type, entity_id, since, sla_level),
    CONSTRAINT ck_sla_level CHECK (sla_level IN ('WARNING', 'BREACH'))
);
CREATE INDEX idx_sla_escalations_district ON sla_escalations (district_id, created_at DESC);
CREATE TRIGGER trg_sla_escalations_append_only
    BEFORE UPDATE OR DELETE ON sla_escalations
    FOR EACH ROW EXECUTE FUNCTION forbid_change_of_history();

INSERT INTO permissions (code, description) VALUES
    ('SLA_READ',        'View SLA status, overdue items and the escalation log within the geographic scope'),
    ('SETTINGS_MANAGE', 'Change SLA limits, run an SLA scan and view system settings');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'SLA_READ'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN', 'MINISTRY_ADMIN', 'STATE_ADMIN', 'DIVISION_ADMIN', 'DISTRICT_ADMIN',
                 'SCRUTINY_OFFICER', 'FIELD_OFFICER', 'COMPETENT_AUTHORITY', 'FINANCE_OFFICER', 'AUDITOR');
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'SETTINGS_MANAGE'
WHERE r.code IN ('SUPER_ADMIN', 'CENTRAL_ADMIN');