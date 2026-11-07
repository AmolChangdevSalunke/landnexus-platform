package com.landnexus.compensation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.acquisition.application.AcquisitionLookupService;
import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.compensation.api.dto.CompensationDtos.ComponentRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetRequest;
import com.landnexus.compensation.api.dto.CompensationDtos.RuleSetResponse;
import com.landnexus.compensation.application.RuleSetService.Selected;
import com.landnexus.compensation.domain.CompTypes.ComponentType;
import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import com.landnexus.compensation.domain.RuleSet;
import com.landnexus.compensation.domain.RuleSetComponent;
import com.landnexus.compensation.infrastructure.RuleSetComponentRepository;
import com.landnexus.compensation.infrastructure.RuleSetRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RuleSetServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 1);

    @Mock private RuleSetRepository ruleSets;
    @Mock private RuleSetComponentRepository components;
    @Mock private AcquisitionLookupService acquisition;
    @Mock private AdministrationLookupService admin;
    @Mock private AuditService audit;

    private RuleSetService service;
    private final UUID stateId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final CurrentActor drafter = new CurrentActor(UUID.randomUUID(), "drafter", Set.of("CENTRAL_ADMIN"), Set.of("RULESET_MANAGE"));
    private final CurrentActor approver = new CurrentActor(UUID.randomUUID(), "approver", Set.of("SUPER_ADMIN"), Set.of("RULESET_APPROVE"));

    @BeforeEach
    void setUp() {
        service = new RuleSetService(ruleSets, components, acquisition, admin, audit,
                Clock.fixed(Instant.parse("2026-11-07T10:00:00Z"), ZoneOffset.UTC));
        lenient().when(acquisition.frameworks()).thenReturn(List.of("LARR_2013", "OTHER"));
        lenient().when(ruleSets.saveAndFlush(any(RuleSet.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(components.save(any(RuleSetComponent.class))).thenAnswer(i -> i.getArgument(0));
    }

    private static List<ComponentRequest> valid() {
        return List.of(
                new ComponentRequest("LAND", "Land value", ComponentType.LAND_VALUE, new BigDecimal("1.5"), null),
                new ComponentRequest("ASSETS", "Assets", ComponentType.ASSET_VALUE, null, null),
                new ComponentRequest("SOLATIUM", "Solatium", ComponentType.PERCENT_OF, new BigDecimal("100"), List.of("LAND", "ASSETS")));
    }

    private RuleSetRequest request(List<ComponentRequest> list) {
        return new RuleSetRequest("DEMO", "LARR_2013", null, null, DAY, null, "DEMO", list);
    }

    private static RuleSet approved(String name, UUID state, UUID district, LocalDate from, LocalDate to) {
        RuleSet rs = new RuleSet(name, 1, "LARR_2013", state, district, from, to, null, UUID.randomUUID());
        ReflectionTestUtils.setField(rs, "id", UUID.randomUUID());
        rs.approve(UUID.randomUUID(), Instant.now());
        return rs;
    }

    @Test
    void create_storesVersionOneAsDraft_withOrderedComponents() {
        RuleSetResponse r = service.create(request(valid()), drafter);

        assertThat(r.version()).isEqualTo(1);
        assertThat(r.status()).isEqualTo(RuleSetStatus.DRAFT);
        assertThat(r.components()).extracting(c -> c.code()).containsExactly("LAND", "ASSETS", "SOLATIUM");
        verify(audit).record(eq("CREATE"), eq("RuleSet"), any(), anyString());
    }

    @Test
    void create_rejectsBrokenRuleSets() {
        assertThatThrownBy(() -> service.create(request(List.of(
                new ComponentRequest("ASSETS", "A", ComponentType.ASSET_VALUE, null, null))), drafter))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("LAND_VALUE");
        assertThatThrownBy(() -> service.create(request(List.of(
                new ComponentRequest("LAND", "L", ComponentType.LAND_VALUE, new BigDecimal("11"), null))), drafter))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("multiplier");
        assertThatThrownBy(() -> service.create(request(List.of(
                new ComponentRequest("SOL", "S", ComponentType.PERCENT_OF, BigDecimal.TEN, List.of("LAND")),
                new ComponentRequest("LAND", "L", ComponentType.LAND_VALUE, BigDecimal.ONE, null))), drafter))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("EARLIER");
        assertThatThrownBy(() -> service.create(request(List.of(
                new ComponentRequest("LAND", "L", ComponentType.LAND_VALUE, BigDecimal.ONE, null),
                new ComponentRequest("LAND", "L2", ComponentType.FIXED_PER_HECTARE, BigDecimal.ONE, null))), drafter))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("Duplicate");
    }

    @Test
    void create_unknownFrameworkOrDistrict_isRejected() {
        assertThatThrownBy(() -> service.create(new RuleSetRequest("X", "NOPE", null, null, DAY, null, null, valid()), drafter))
                .isInstanceOf(InvalidRequestException.class);
        when(admin.findActiveDistrict(districtId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(new RuleSetRequest("X", "LARR_2013", null, districtId, DAY, null, null, valid()), drafter))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void approve_byTheDrafter_isForbidden_byAnotherPersonItWorks() {
        RuleSet rs = new RuleSet("DEMO", 1, "LARR_2013", null, null, DAY, null, null, drafter.userId());
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(rs, "id", id);
        when(ruleSets.findById(id)).thenReturn(Optional.of(rs));

        assertThatThrownBy(() -> service.approve(id, drafter)).isInstanceOf(AccessDeniedException.class);
        assertThat(service.approve(id, approver).status()).isEqualTo(RuleSetStatus.APPROVED);
        assertThatThrownBy(() -> service.approve(id, approver)).isInstanceOf(InvalidTransitionException.class);
    }

    @Test
    void approve_overlappingAnotherApprovedSetForTheSamePlace_isRefused() {
        RuleSet draft = new RuleSet("NEW", 1, "LARR_2013", null, null, DAY, null, null, drafter.userId());
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(draft, "id", id);
        when(ruleSets.findById(id)).thenReturn(Optional.of(draft));
        when(ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, "LARR_2013"))
                .thenReturn(List.of(approved("OLD", null, null, DAY.minusYears(1), null)));

        assertThatThrownBy(() -> service.approve(id, approver)).isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("overlaps");
    }

    @Test
    void select_prefersDistrictOverStateOverNationwide() {
        when(ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, "LARR_2013")).thenReturn(List.of(
                approved("NATIONAL", null, null, DAY.minusYears(1), null),
                approved("STATE", stateId, null, DAY.minusYears(1), null),
                approved("DISTRICT", stateId, districtId, DAY.minusYears(1), null),
                approved("OTHER-DISTRICT", stateId, UUID.randomUUID(), DAY.minusYears(1), null)));

        Selected s = service.selectFor(stateId, districtId, "LARR_2013", DAY);

        assertThat(s.ruleSet().getName()).isEqualTo("DISTRICT");
        assertThat(service.selectFor(stateId, UUID.randomUUID(), "LARR_2013", DAY).ruleSet().getName()).isEqualTo("STATE");
        assertThat(service.selectFor(UUID.randomUUID(), UUID.randomUUID(), "LARR_2013", DAY).ruleSet().getName()).isEqualTo("NATIONAL");
    }

    @Test
    void select_respectsTheValidityPeriod_andNeverGuesses() {
        when(ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, "LARR_2013")).thenReturn(List.of(
                approved("EXPIRED", null, null, DAY.minusYears(3), DAY.minusYears(1))));
        assertThatThrownBy(() -> service.selectFor(stateId, districtId, "LARR_2013", DAY)).isInstanceOf(InvalidRequestException.class);

        when(ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, "LARR_2013")).thenReturn(List.of(
                approved("A", null, null, DAY.minusYears(1), null), approved("B", null, null, DAY.minusYears(1), null)));
        assertThatThrownBy(() -> service.selectFor(stateId, districtId, "LARR_2013", DAY))
                .isInstanceOf(InvalidRequestException.class).hasMessageContaining("More than one");
    }

    @Test
    void select_afterTheLatestStart_theNewerVersionWins() {
        when(ruleSets.findByStatusAndFramework(RuleSetStatus.APPROVED, "LARR_2013")).thenReturn(List.of(
                approved("OLD", null, null, DAY.minusYears(2), DAY.minusMonths(1)),
                approved("NEW", null, null, DAY.minusMonths(1).plusDays(1), null)));

        assertThat(service.selectFor(stateId, districtId, "LARR_2013", DAY).ruleSet().getName()).isEqualTo("NEW");
    }

    @Test
    void retire_needsAReason() {
        assertThatThrownBy(() -> service.retire(UUID.randomUUID(), " ", drafter)).isInstanceOf(InvalidRequestException.class);
    }
}