package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Taluka;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record TalukaResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        UUID districtId,
        String districtName,
        Instant createdAt,
        Instant updatedAt) {

    public static TalukaResponse from(Taluka e) {
        return new TalukaResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getDistrict() == null ? null : e.getDistrict().getId(),
                e.getDistrict() == null ? null : e.getDistrict().getName(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
