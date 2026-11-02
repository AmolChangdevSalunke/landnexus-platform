package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.LoginHistory;
import java.time.Instant;
import java.util.UUID;

public record LoginHistoryResponse(
        UUID id,
        Instant occurredAt,
        UUID userId,
        String usernameAttempted,
        boolean success,
        String failureReason,
        String ipAddress,
        String userAgent) {

    public static LoginHistoryResponse from(LoginHistory h) {
        return new LoginHistoryResponse(h.getId(), h.getOccurredAt(), h.getUserId(), h.getUsernameAttempted(),
                h.isSuccess(), h.getFailureReason(), h.getIpAddress(), h.getUserAgent());
    }
}
