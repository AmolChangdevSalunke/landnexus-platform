package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProjectStatus;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.Project;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String code,
        UUID proposalId,
        String title,
        ProjectType projectType,
        ProjectStatus status,
        UUID stateId,
        UUID districtId,
        UUID talukaId,
        UUID departmentId,
        BigDecimal lengthKm,
        BigDecimal estimatedLandAreaHa,
        Set<UUID> villageIds,
        UUID ownerUserId,
        UUID approvedByUserId,
        Instant approvedAt,
        Instant createdAt) {

    public static ProjectResponse from(Project p) {
        return new ProjectResponse(p.getId(), p.getCode(), p.getProposalId(), p.getTitle(), p.getProjectType(),
                p.getStatus(), p.getStateId(), p.getDistrictId(), p.getTalukaId(), p.getDepartmentId(),
                p.getLengthKm(), p.getEstimatedLandAreaHa(), new TreeSet<>(p.getVillageIds()),
                p.getOwnerUserId(), p.getApprovedByUserId(), p.getApprovedAt(), p.getCreatedAt());
    }
}
