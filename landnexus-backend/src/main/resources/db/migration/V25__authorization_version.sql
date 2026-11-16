-- V25: invalidate already-issued access tokens after authorization changes.
ALTER TABLE users ADD COLUMN authorization_version BIGINT NOT NULL DEFAULT 0;
