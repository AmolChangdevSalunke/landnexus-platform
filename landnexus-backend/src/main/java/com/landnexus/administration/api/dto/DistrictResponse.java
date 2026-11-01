package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.District;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record DistrictResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        UUID stateId,
        String stateName,
        UUID divisionId,
        String divisionName,
        Instant createdAt,
        Instant updatedAt) {

    public static DistrictResponse from(District e) {
        return new DistrictResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getState() == null ? null : e.getState().getId(),
                e.getState() == null ? null : e.getState().getName(),
                e.getDivision() == null ? null : e.getDivision().getId(),
                e.getDivision() == null ? null : e.getDivision().getName(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
