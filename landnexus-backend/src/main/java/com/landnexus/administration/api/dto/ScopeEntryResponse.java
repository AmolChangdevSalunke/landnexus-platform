package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.GeographicScope;
import java.util.UUID;

public record ScopeEntryResponse(UUID id, String type, UUID referenceId, String referenceName) {

    public static ScopeEntryResponse from(GeographicScope scope) {
        return new ScopeEntryResponse(scope.getId(), scope.type(), scope.referenceId(), scope.referenceName());
    }
}
