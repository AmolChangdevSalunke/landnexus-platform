package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProposalVersion;
import java.time.Instant;

public record ProposalVersionResponse(int versionNo, String createdByUsername, Instant createdAt, String snapshot) {

    public static ProposalVersionResponse from(ProposalVersion v) {
        return new ProposalVersionResponse(v.getVersionNo(), v.getCreatedByUsername(), v.getCreatedAt(), v.getSnapshot());
    }
}
