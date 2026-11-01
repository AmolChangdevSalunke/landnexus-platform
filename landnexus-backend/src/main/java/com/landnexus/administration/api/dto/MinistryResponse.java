package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Ministry;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record MinistryResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        Instant createdAt,
        Instant updatedAt) {

    public static MinistryResponse from(Ministry e) {
        return new MinistryResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
