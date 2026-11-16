package com.landnexus.projects.api.dto;

import com.landnexus.projects.domain.RoutingRule;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class RoutingRuleDtos {

    private RoutingRuleDtos() {
    }

    public record RoutingRuleRequest(
            @NotBlank @Size(max = 100) String name,
            @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal minAreaHa,
            @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal maxAreaHa,
            @Size(max = 40) String projectType,
            @NotBlank @Pattern(regexp = "DISTRICT|STATE|CENTRAL") String decisionLevel,
            @Size(max = 300) String note) {
    }

    public record RoutingRuleResponse(UUID id, String name, BigDecimal minAreaHa, BigDecimal maxAreaHa,
                                      String projectType, String decisionLevel, boolean active, String note,
                                      Instant createdAt) {

        public static RoutingRuleResponse from(RoutingRule rule) {
            return new RoutingRuleResponse(rule.getId(), rule.getName(), rule.getMinAreaHa(), rule.getMaxAreaHa(),
                    rule.getProjectType(), rule.getDecisionLevel(), rule.isActive(), rule.getNote(), rule.getCreatedAt());
        }
    }
}
