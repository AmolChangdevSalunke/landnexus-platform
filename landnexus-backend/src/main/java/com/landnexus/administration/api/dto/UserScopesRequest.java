package com.landnexus.administration.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** The complete new scope list for a user (it replaces the old one; an empty list removes all scopes). */
public record UserScopesRequest(@NotNull @Size(max = 200) List<@Valid @NotNull ScopeEntryRequest> scopes) {
}
