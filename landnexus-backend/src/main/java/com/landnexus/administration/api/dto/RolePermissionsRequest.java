package com.landnexus.administration.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

/** Replaces the complete permission set of a role. An empty set is allowed only for non-super roles. */
public record RolePermissionsRequest(@NotNull Set<@NotBlank String> permissions) {
}
