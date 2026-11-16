package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProjectType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

/**
 * The editable part of a project. Code, originating proposal, owner and approval facts are immutable.
 * The state is derived from the district, so the two can never disagree.
 */
public record ProjectUpdateRequest(
        @NotBlank @Size(max = 200) String title,
        @NotNull ProjectType projectType,
        @NotNull UUID districtId,
        UUID talukaId,
        @NotNull UUID departmentId,
        @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal lengthKm,
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal estimatedLandAreaHa,
        @NotEmpty @Size(max = 500) Set<@NotNull UUID> villageIds) {
}
