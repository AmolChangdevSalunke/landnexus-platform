package com.landnexus.administration.api.dto;

import java.util.UUID;

/** Exactly one of the three ids must be set. */
public record ScopeEntryRequest(UUID stateId, UUID divisionId, UUID districtId) {
}
