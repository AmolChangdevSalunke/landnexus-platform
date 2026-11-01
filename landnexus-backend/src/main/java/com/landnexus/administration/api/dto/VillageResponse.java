package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Village;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record VillageResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        UUID talukaId,
        String talukaName,
        Instant createdAt,
        Instant updatedAt) {

    public static VillageResponse from(Village e) {
        return new VillageResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getTaluka() == null ? null : e.getTaluka().getId(),
                e.getTaluka() == null ? null : e.getTaluka().getName(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
