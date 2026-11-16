package com.landnexus.administration.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public final class UserPermissionDtos {

    private UserPermissionDtos() {
    }

    public record OverrideRequest(@NotBlank @Size(max = 60) String code, @NotNull Boolean granted) {
    }

    public record UpdateRequest(@NotNull @Size(max = 300) List<@Valid OverrideRequest> overrides) {
    }

    public record PermissionEntry(String code, String description, boolean roleGranted, Boolean override,
                                  boolean effective) {
    }

    public record UserPermissions(UUID userId, List<PermissionEntry> permissions) {
    }
}
