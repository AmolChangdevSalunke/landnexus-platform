package com.landnexus.shared.notification;

/** A provider could not accept a message. The message text is safe to store in last_error. */
public class NotificationDeliveryException extends RuntimeException {

    public NotificationDeliveryException(String message) {
        super(message);
    }

    public NotificationDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
