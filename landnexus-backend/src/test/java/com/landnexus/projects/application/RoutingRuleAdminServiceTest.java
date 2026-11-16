package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.projects.api.dto.RoutingRuleDtos.RoutingRuleRequest;
import com.landnexus.projects.domain.RoutingRule;
import com.landnexus.projects.infrastructure.RoutingRuleRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RoutingRuleAdminServiceTest {

    @Mock private RoutingRuleRepository rules;
    @Mock private AuditService audit;
    private RoutingRuleAdminService service;
    private final CurrentActor admin = new CurrentActor(UUID.randomUUID(), "central", Set.of("CENTRAL_ADMIN"));

    @BeforeEach
    void setUp() {
        service = new RoutingRuleAdminService(rules, audit);
    }

    @Test
    void create_savesNormalizedRuleAndAuditsIt() {
        RoutingRuleRequest request = new RoutingRuleRequest(
                "  Highway scrutiny  ", new BigDecimal("0"), new BigDecimal("50"),
                "state_highway", "DISTRICT", " demo rule ");
        when(rules.existsByNameIgnoreCase("Highway scrutiny")).thenReturn(false);
        when(rules.saveAndFlush(org.mockito.ArgumentMatchers.any(RoutingRule.class)))
                .thenAnswer(invocation -> {
                    RoutingRule rule = invocation.getArgument(0);
                    ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
                    return rule;
                });

        var saved = service.create(request, admin);

        assertThat(saved.name()).isEqualTo("Highway scrutiny");
        assertThat(saved.projectType()).isEqualTo("STATE_HIGHWAY");
        assertThat(saved.note()).isEqualTo("demo rule");
        verify(audit).record("CREATE_ROUTING_RULE", "RoutingRule", saved.id(),
                "level=DISTRICT, active=true");
    }

    @Test
    void create_rejectsOverlappingRangeDefinitionWithMaxNotAboveMin() {
        RoutingRuleRequest request = new RoutingRuleRequest(
                "Invalid band", new BigDecimal("50"), new BigDecimal("50"), null, "STATE", null);

        assertThatThrownBy(() -> service.create(request, admin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("greater than minimum");
    }

    @Test
    void create_rejectsUnknownProjectType() {
        RoutingRuleRequest request = new RoutingRuleRequest(
                "Unknown type", null, null, "UNKNOWN", "STATE", null);

        assertThatThrownBy(() -> service.create(request, admin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Unknown project type");
    }

    @Test
    void create_rejectsDuplicateName() {
        when(rules.existsByNameIgnoreCase("District")).thenReturn(true);

        assertThatThrownBy(() -> service.create(
                new RoutingRuleRequest("District", null, null, null, "DISTRICT", null), admin))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void cannotDeactivateLastActiveRule() {
        UUID id = UUID.randomUUID();
        RoutingRule rule = new RoutingRule("Only rule", null, null, null, "STATE", null);
        ReflectionTestUtils.setField(rule, "id", id);
        when(rules.findById(id)).thenReturn(Optional.of(rule));
        when(rules.countByActiveTrue()).thenReturn(1L);

        assertThatThrownBy(() -> service.setActive(id, false, admin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("At least one active");
    }

    @Test
    void listReturnsRepositoryOrderedRules() {
        RoutingRule rule = new RoutingRule("District", BigDecimal.ZERO, new BigDecimal("100"),
                null, "DISTRICT", "DEMO");
        when(rules.findAllByOrderByMinAreaHaAscNameAsc()).thenReturn(List.of(rule));

        assertThat(service.list()).hasSize(1);
        verify(rules).findAllByOrderByMinAreaHaAscNameAsc();
    }
}
