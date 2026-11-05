package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalStatusHistory;
import java.time.Instant;
import java.util.UUID;

public record ProposalHistoryResponse(
        UUID id,
        ProposalStatus fromStatus,
        ProposalStatus toStatus,
        String action,
        String actorUsername,
        String reason,
        Instant occurredAt) {

    public static ProposalHistoryResponse from(ProposalStatusHistory h) {
        return new ProposalHistoryResponse(h.getId(), h.getFromStatus(), h.getToStatus(), h.getAction(),
                h.getActorUsername(), h.getReason(), h.getOccurredAt());
    }
}
