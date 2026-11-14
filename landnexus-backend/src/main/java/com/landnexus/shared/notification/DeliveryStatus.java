package com.landnexus.shared.notification;

/** The state of one external delivery attempt. PENDING and RETRY are due for dispatch. */
public enum DeliveryStatus {
    PENDING,
    SENT,
    FAILED,
    RETRY
}
