package com.landnexus.administration.domain;

/** Master records are never hard-deleted; they are deactivated so history stays intact. */
public enum RecordStatus {
    ACTIVE,
    INACTIVE
}
