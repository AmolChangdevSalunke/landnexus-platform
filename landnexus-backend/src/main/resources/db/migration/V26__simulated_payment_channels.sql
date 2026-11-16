-- Explicit simulated rail classification. Existing transactions remain unclassified;
-- their channel is never inferred from status, reference, or other payment data.
ALTER TABLE compensation_payments
    ADD COLUMN payment_channel VARCHAR(24) NOT NULL DEFAULT 'UNCLASSIFIED';

ALTER TABLE compensation_payments
    ADD CONSTRAINT ck_payment_channel CHECK (
        payment_channel IN ('UNCLASSIFIED', 'PFMS_SIMULATED', 'DBT_SIMULATED', 'OTHER_SIMULATED')
    );

CREATE INDEX idx_payments_channel_status_created
    ON compensation_payments (payment_channel, status, created_at);
