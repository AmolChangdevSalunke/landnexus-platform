package com.landnexus.shared.notification;

import java.util.UUID;

/** One message handed to a provider adapter. The raw destination never leaves this object. */
public record OutboundNotification(
        UUID deliveryId,
        NotificationChannel channel,
        UUID recipientUserId,
        String destination,
        String maskedDestination,
        String subject,
        String body,
        String entityType,
        UUID entityId) {
}
