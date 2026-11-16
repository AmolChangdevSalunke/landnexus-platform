package com.landnexus.projects.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Routing records. User ids and proposal references only: no personal data. */
public final class AssignmentDtos {

    private AssignmentDtos() {
    }

    public record AssignmentResponse(UUID id, UUID proposalId, String stage, UUID assignedUserId,
                                     String assignedUsername, String assignedBy, String ruleNote, String status,
                                     Instant assignedAt, Instant startedAt, Instant completedAt, Instant dueAt,
                                     boolean overdue) {
    }

    public record MyTaskResponse(UUID assignmentId, UUID proposalId, String proposalNumber, String title,
                                 String stage, String assignmentStatus, String proposalStatus, Instant assignedAt,
                                 Instant dueAt, boolean overdue, BigDecimal estimatedLandAreaHa, UUID districtId,
                                 String districtName, String projectType) {
    }

    public record ReassignmentRequest(@NotNull UUID assignedUserId,
                                      @NotBlank @Size(max = 250) String reason) {
    }

    public record ReassignmentCandidate(UUID id, String username, String scopeLevel) {
    }
}
