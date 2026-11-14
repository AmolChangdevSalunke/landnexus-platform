-- External notification delivery: contacts, the transactional outbox and delivery records.
-- In-app notifications stay in the existing notifications table. EMAIL and SMS are opt-in:
-- a channel is only used when its provider is configured (LANDNEXUS_NOTIFICATIONS_*).

-- Optional per-user contact details and channel preferences. When a user has no row, the
-- e-mail address on users is used for EMAIL and SMS stays disabled (there is no phone on users).
CREATE TABLE notification_contacts (
    user_id       UUID         PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    email         VARCHAR(150),
    phone         VARCHAR(32),
    email_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
    sms_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_notification_contacts_email_lower CHECK (email IS NULL OR email = lower(email))
);

-- One row per notification and channel. Rows are written in the same transaction as the
-- in-app notification (transactional outbox) and sent later by the dispatcher, so a slow or
-- failing provider never blocks approval or any other business transaction.
CREATE TABLE notification_deliveries (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     UUID         NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    recipient_user_id   UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    channel             VARCHAR(20)  NOT NULL,
    destination_masked  VARCHAR(200) NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    attempts            INTEGER      NOT NULL DEFAULT 0,
    max_attempts        INTEGER      NOT NULL DEFAULT 5,
    next_attempt_at     TIMESTAMPTZ,
    last_attempt_at     TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    provider            VARCHAR(60),
    last_error          VARCHAR(1000),
    dedupe_key          VARCHAR(255) NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_deliveries_dedupe UNIQUE (dedupe_key),
    CONSTRAINT uq_notification_deliveries_channel UNIQUE (notification_id, channel),
    CONSTRAINT ck_notification_deliveries_channel CHECK (channel IN ('EMAIL', 'SMS')),
    CONSTRAINT ck_notification_deliveries_status CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'RETRY')),
    CONSTRAINT ck_notification_deliveries_attempts CHECK (attempts >= 0 AND max_attempts >= 1)
);

CREATE INDEX idx_notification_deliveries_due
    ON notification_deliveries (status, next_attempt_at);
CREATE INDEX idx_notification_deliveries_recipient
    ON notification_deliveries (recipient_user_id, created_at DESC);
CREATE INDEX idx_notification_deliveries_notification
    ON notification_deliveries (notification_id);
