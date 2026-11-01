package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.DepartmentLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record DepartmentRequest(
        @NotBlank @Size(max = 30) String code,
        @NotBlank @Size(max = 150) String name,
        @NotNull UUID ministryId,
        @NotNull DepartmentLevel level) {
}
