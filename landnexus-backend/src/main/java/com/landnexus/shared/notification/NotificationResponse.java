package com.landnexus.shared.notification;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        String type,
        String title,
        String message,
        String entityType,
        UUID entityId,
        boolean read,
        Instant createdAt) {

    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                n.getEntityType(), n.getEntityId(), n.getReadAt() != null, n.getCreatedAt());
    }
}
