package com.landnexus.projects.api.dto;

import java.util.List;
import java.util.UUID;

public record ProposalValidationResponse(
        UUID proposalId,
        boolean passed,
        List<Item> items) {
    public record Item(String code, String severity, String message) {}
}
