package com.landnexus.shared.notification;

import java.time.Instant;
import java.util.UUID;

/** Administrator view of an external delivery. The destination is always masked. */
public record NotificationDeliveryResponse(
        UUID id,
        UUID notificationId,
        UUID recipientUserId,
        String channel,
        String destinationMasked,
        String status,
        int attempts,
        int maxAttempts,
        Instant nextAttemptAt,
        Instant lastAttemptAt,
        Instant sentAt,
        String provider,
        String lastError,
        Instant createdAt) {

    public static NotificationDeliveryResponse from(NotificationDelivery delivery) {
        return new NotificationDeliveryResponse(
                delivery.getId(), delivery.getNotificationId(), delivery.getRecipientUserId(),
                delivery.getChannel().name(), delivery.getDestinationMasked(), delivery.getStatus().name(),
                delivery.getAttempts(), delivery.getMaxAttempts(), delivery.getNextAttemptAt(),
                delivery.getLastAttemptAt(), delivery.getSentAt(), delivery.getProvider(),
                delivery.getLastError(), delivery.getCreatedAt());
    }
}
