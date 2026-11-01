package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.UserAccount;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Never contains the password hash. */
public record UserResponse(
        UUID id,
        String username,
        String email,
        String fullName,
        boolean enabled,
        Set<String> roles,
        Instant lastLoginAt,
        Instant createdAt) {

    public static UserResponse from(UserAccount user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail(), user.getFullName(),
                user.isEnabled(), user.roleCodes(), user.getLastLoginAt(), user.getCreatedAt());
    }
}
