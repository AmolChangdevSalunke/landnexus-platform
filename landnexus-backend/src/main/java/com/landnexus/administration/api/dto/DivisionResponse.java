package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Division;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record DivisionResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        UUID stateId,
        String stateName,
        Instant createdAt,
        Instant updatedAt) {

    public static DivisionResponse from(Division e) {
        return new DivisionResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getState() == null ? null : e.getState().getId(),
                e.getState() == null ? null : e.getState().getName(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
