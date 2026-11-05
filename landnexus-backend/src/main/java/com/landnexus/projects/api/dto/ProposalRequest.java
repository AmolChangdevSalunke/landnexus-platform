package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.ProjectType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * What a consultant fills in. The state is derived from the district, so it cannot disagree with it.
 * Land area is in hectares; length is in kilometres and is required for roads, expressways and railways.
 */
public record ProposalRequest(
        @NotBlank @Size(max = 200) String title,
        @NotNull ProjectType projectType,
        @NotNull UUID districtId,
        UUID talukaId,
        @NotNull UUID departmentId,
        @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal lengthKm,
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal estimatedLandAreaHa,
        @NotEmpty @Size(max = 500) Set<@NotNull UUID> villageIds,
        @Size(max = 1000) String alignmentDescription,
        @NotBlank @Size(max = 2000) String description,
        @NotNull LocalDate plannedStartDate,
        @NotNull LocalDate plannedEndDate) {
}
