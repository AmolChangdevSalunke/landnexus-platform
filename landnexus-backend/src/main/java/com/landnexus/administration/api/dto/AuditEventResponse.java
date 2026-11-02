package com.landnexus.administration.api.dto;

import com.landnexus.shared.audit.AuditEvent;
import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
        UUID id,
        Instant occurredAt,
        UUID actorUserId,
        String actorUsername,
        String action,
        String entityType,
        UUID entityId,
        String details) {

    public static AuditEventResponse from(AuditEvent e) {
        return new AuditEventResponse(e.getId(), e.getOccurredAt(), e.getActorUserId(), e.getActorUsername(),
                e.getAction(), e.getEntityType(), e.getEntityId(), e.getDetails());
    }
}
