package com.landnexus.projects.application;

import com.landnexus.projects.api.dto.RoutingRuleDtos.RoutingRuleRequest;
import com.landnexus.projects.api.dto.RoutingRuleDtos.RoutingRuleResponse;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.RoutingRule;
import com.landnexus.projects.infrastructure.RoutingRuleRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RoutingRuleAdminService {

    private final RoutingRuleRepository rules;
    private final AuditService audit;

    public RoutingRuleAdminService(RoutingRuleRepository rules, AuditService audit) {
        this.rules = rules;
        this.audit = audit;
    }

    public List<RoutingRuleResponse> list() {
        return rules.findAllByOrderByMinAreaHaAscNameAsc().stream()
                .map(RoutingRuleResponse::from)
                .toList();
    }

    @Transactional
    public RoutingRuleResponse create(RoutingRuleRequest request, CurrentActor actor) {
        Normalized value = validate(request);
        if (rules.existsByNameIgnoreCase(value.name())) {
            throw new DuplicateResourceException("A routing rule already uses this name");
        }
        RoutingRule saved = rules.saveAndFlush(new RoutingRule(value.name(), value.minAreaHa(), value.maxAreaHa(),
                value.projectType(), value.decisionLevel(), value.note()));
        audit.record("CREATE_ROUTING_RULE", "RoutingRule", saved.getId(),
                "level=" + saved.getDecisionLevel() + ", active=" + saved.isActive());
        return RoutingRuleResponse.from(saved);
    }

    @Transactional
    public RoutingRuleResponse update(UUID id, RoutingRuleRequest request, CurrentActor actor) {
        RoutingRule rule = load(id);
        Normalized value = validate(request);
        if (rules.existsByNameIgnoreCaseAndIdNot(value.name(), id)) {
            throw new DuplicateResourceException("A routing rule already uses this name");
        }
        rule.update(value.name(), value.minAreaHa(), value.maxAreaHa(), value.projectType(),
                value.decisionLevel(), value.note());
        RoutingRule saved = rules.saveAndFlush(rule);
        audit.record("UPDATE_ROUTING_RULE", "RoutingRule", saved.getId(),
                "level=" + saved.getDecisionLevel() + ", active=" + saved.isActive());
        return RoutingRuleResponse.from(saved);
    }

    @Transactional
    public RoutingRuleResponse setActive(UUID id, boolean active, CurrentActor actor) {
        RoutingRule rule = load(id);
        if (rule.isActive() == active) {
            return RoutingRuleResponse.from(rule);
        }
        if (!active && rules.countByActiveTrue() <= 1) {
            throw new InvalidRequestException("At least one active routing rule must remain");
        }
        rule.setActive(active);
        RoutingRule saved = rules.saveAndFlush(rule);
        audit.record(active ? "ACTIVATE_ROUTING_RULE" : "DEACTIVATE_ROUTING_RULE",
                "RoutingRule", saved.getId(), "active=" + active);
        return RoutingRuleResponse.from(saved);
    }

    private RoutingRule load(UUID id) {
        return rules.findById(id).orElseThrow(() -> new ResourceNotFoundException("Routing rule not found: " + id));
    }

    private static Normalized validate(RoutingRuleRequest request) {
        String name = request.name().trim();
        BigDecimal min = request.minAreaHa();
        BigDecimal max = request.maxAreaHa();
        if (min != null && max != null && max.compareTo(min) <= 0) {
            throw new InvalidRequestException("Maximum area must be greater than minimum area");
        }
        String type = request.projectType() == null || request.projectType().isBlank()
                ? null : request.projectType().trim().toUpperCase(Locale.ROOT);
        if (type != null && Arrays.stream(ProjectType.values()).noneMatch(projectType -> projectType.name().equals(type))) {
            throw new InvalidRequestException("Unknown project type: " + type);
        }
        return new Normalized(name, min, max, type, request.decisionLevel(), blankToNull(request.note()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Normalized(String name, BigDecimal minAreaHa, BigDecimal maxAreaHa, String projectType,
                              String decisionLevel, String note) {
    }
}
