package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/** availableActions lists what the caller may do right now, so the UI never has to guess the rules. */
public record ProposalResponse(
        UUID id,
        String proposalNumber,
        String title,
        ProjectType projectType,
        ProposalStatus status,
        int versionNo,
        UUID stateId,
        UUID districtId,
        UUID talukaId,
        UUID departmentId,
        BigDecimal lengthKm,
        BigDecimal estimatedLandAreaHa,
        Set<UUID> villageIds,
        String alignmentDescription,
        String description,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        UUID ownerUserId,
        Instant submittedAt,
        Instant createdAt,
        Instant updatedAt,
        String projectCode,
        String acquisitionCaseNumber,
        List<String> availableActions) {

    public static ProposalResponse from(Proposal p, String projectCode, String acquisitionCaseNumber, List<String> availableActions) {
        return new ProposalResponse(p.getId(), p.getProposalNumber(), p.getTitle(), p.getProjectType(), p.getStatus(),
                p.getVersionNo(), p.getStateId(), p.getDistrictId(), p.getTalukaId(), p.getDepartmentId(),
                p.getLengthKm(), p.getEstimatedLandAreaHa(), new TreeSet<>(p.getVillageIds()),
                p.getAlignmentDescription(), p.getDescription(), p.getPlannedStartDate(), p.getPlannedEndDate(),
                p.getOwnerUserId(), p.getSubmittedAt(), p.getCreatedAt(), p.getUpdatedAt(), projectCode,
                acquisitionCaseNumber, availableActions);
    }

    public static ProposalResponse from(Proposal p, String projectCode, List<String> availableActions) {
        return from(p, projectCode, null, availableActions);
    }
}
