package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Department;
import com.landnexus.administration.domain.DepartmentLevel;
import com.landnexus.administration.domain.RecordStatus;
import java.time.Instant;
import java.util.UUID;

public record DepartmentResponse(
        UUID id,
        String code,
        String name,
        RecordStatus status,
        UUID ministryId,
        String ministryName,
        DepartmentLevel level,
        Instant createdAt,
        Instant updatedAt) {

    public static DepartmentResponse from(Department e) {
        return new DepartmentResponse(
                e.getId(),
                e.getCode(),
                e.getName(),
                e.getStatus(),
                e.getMinistry() == null ? null : e.getMinistry().getId(),
                e.getMinistry() == null ? null : e.getMinistry().getName(),
                e.getLevel(),
                e.getCreatedAt(),
                e.getUpdatedAt());
    }
}
