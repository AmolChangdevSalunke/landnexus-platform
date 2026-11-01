package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.State;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record StateResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        Instant createdAt,
        Instant updatedAt) {

    public static StateResponse from(State e) {
        return new StateResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
