package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.UserAccount;
import java.util.Set;
import java.util.UUID;

public record CurrentUserResponse(
        UUID id,
        String username,
        String fullName,
        String email,
        Set<String> roles,
        Set<String> permissions) {

    public static CurrentUserResponse from(UserAccount user) {
        return new CurrentUserResponse(user.getId(), user.getUsername(), user.getFullName(), user.getEmail(),
                user.roleCodes(), user.permissionCodes());
    }
}
