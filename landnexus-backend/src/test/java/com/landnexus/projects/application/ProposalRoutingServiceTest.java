package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.RoutingCandidate;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalAssignment;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.projects.domain.RoutingRule;
import com.landnexus.projects.infrastructure.ProposalAssignmentRepository;
import com.landnexus.projects.infrastructure.RoutingRuleRepository;
import com.landnexus.reporting.application.SlaLookupService;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProposalRoutingServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-12T05:00:00Z");
    private static final List<String> OPEN =
            List.of(ProposalAssignment.PENDING, ProposalAssignment.IN_PROGRESS);

    @Mock private ProposalAssignmentRepository assignments;
    @Mock private RoutingRuleRepository rules;
    @Mock private AdministrationLookupService lookup;
    @Mock private NotificationService notifications;
    @Mock private SlaLookupService sla;
    @Mock private AuditService audit;

    private ProposalRoutingService service;

    private final UUID proposalId = UUID.randomUUID();
    private final UUID districtId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();
    private final UUID officerId = UUID.randomUUID();
    private final UUID otherOfficerId = UUID.randomUUID();
    private final UUID authorityId = UUID.randomUUID();
    private final UUID stateAuthorityId = UUID.randomUUID();
    private final CurrentActor actor = new CurrentActor(officerId, "officer", Set.of("SCRUTINY_OFFICER"));

    @BeforeEach
    void setUp() {
        service = new ProposalRoutingService(assignments, rules, lookup, notifications, sla, audit,
                Clock.fixed(NOW, ZoneOffset.UTC));
        lenient().when(assignments.save(any(ProposalAssignment.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(sla.warningHours("PROPOSAL_AWAITING_SCRUTINY")).thenReturn(OptionalInt.of(120));
        lenient().when(assignments.openAssignmentCounts()).thenReturn(List.of());
    }

    // ------------------------------------------------------------------ rules

    @Test
    void areaUpToTheUpperBoundRoutesToTheDistrictLevel() {
        RoutingRule district = rule("0", "100", "DISTRICT");
        RoutingRule state = rule("100", null, "STATE");

        RoutingRule picked = ProposalRoutingService
                .matchingRule(List.of(district, state), "STATE_HIGHWAY", new BigDecimal("100.00"))
                .orElseThrow();

        assertThat(picked.getDecisionLevel()).isEqualTo("DISTRICT");
    }

    @Test
    void areaAboveTheUpperBoundRoutesToTheStateLevel() {
        RoutingRule district = rule("0", "100", "DISTRICT");
        RoutingRule state = rule("100", null, "STATE");

        RoutingRule picked = ProposalRoutingService
                .matchingRule(List.of(district, state), "STATE_HIGHWAY", new BigDecimal("150.01"))
                .orElseThrow();

        assertThat(picked.getDecisionLevel()).isEqualTo("STATE");
    }

    @Test
    void aProjectTypeSpecificRuleWinsOverTheGenericOne() {
        RoutingRule generic = rule("0", "100", "DISTRICT");
        RoutingRule railway = rule(null, null, "CENTRAL");
        when(railway.getProjectType()).thenReturn("RAILWAY");

        RoutingRule picked = ProposalRoutingService
                .matchingRule(List.of(generic, railway), "RAILWAY", new BigDecimal("40"))
                .orElseThrow();

        assertThat(picked.getDecisionLevel()).isEqualTo("CENTRAL");
    }

    // ------------------------------------------------------------------ scrutiny routing

    @Test
    void scrutinyGoesToTheLeastLoadedOfficerAndExcludesTheOwner() {
        RoutingCandidate busiest = new RoutingCandidate(officerId, "aaa-officer", "DISTRICT");
        RoutingCandidate quiet = new RoutingCandidate(otherOfficerId, "zzz-officer", "DISTRICT");
        RoutingCandidate owner = new RoutingCandidate(ownerId, "owner", "DISTRICT");
        when(lookup.findRoutingCandidates("SCRUTINY_OFFICER", districtId)).thenReturn(List.of(busiest, quiet, owner));
        when(assignments.openAssignmentCounts()).thenReturn(List.of(
                new Object[] {officerId, 5L}, new Object[] {otherOfficerId, 0L}));
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.empty());

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.SUBMIT, null, actor);

        ArgumentCaptor<ProposalAssignment> saved = ArgumentCaptor.forClass(ProposalAssignment.class);
        verify(assignments).save(saved.capture());
        assertThat(targeted).isTrue();
        assertThat(saved.getValue().getAssignedUserId()).isEqualTo(otherOfficerId);
        assertThat(saved.getValue().getStage()).isEqualTo(ProposalAssignment.STAGE_SCRUTINY);
        assertThat(saved.getValue().getDueAt()).isEqualTo(NOW.plusSeconds(120 * 3600));
        verify(notifications).notify(eq(otherOfficerId), eq("PROPOSAL"), anyString(), anyString(), eq("Proposal"),
                eq(proposalId));
        verify(audit).record(eq("AUTO_ASSIGN"), eq("Proposal"), eq(proposalId), anyString());
    }

    @Test
    void anAlreadyOpenScrutinyAssignmentIsNotDuplicated() {
        ProposalAssignment open = new ProposalAssignment(proposalId, ProposalAssignment.STAGE_SCRUTINY, officerId,
                "SYSTEM", "existing", NOW.minusSeconds(3600), NOW.plusSeconds(3600));
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.of(open));

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.SUBMIT, null, actor);

        assertThat(targeted).isFalse();
        verify(assignments, never()).save(any());
        verify(lookup, never()).findRoutingCandidates(anyString(), any());
    }

    @Test
    void nobodyEligibleKeepsTheBroadcastAndAlertsTheDistrictAdmins() {
        when(lookup.findRoutingCandidates("SCRUTINY_OFFICER", districtId)).thenReturn(List.of());
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.empty());
        UUID adminId = UUID.randomUUID();
        when(lookup.findUsersByRoleWithDistrictAccess("DISTRICT_ADMIN", districtId))
                .thenReturn(List.of(new UserRef(adminId, "district-admin")));

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.SUBMIT, null, actor);

        assertThat(targeted).isFalse();
        verify(assignments, never()).save(any());
        verify(audit).record("UNASSIGNED", "Proposal", proposalId, "stage=SCRUTINY, reason=NO_ELIGIBLE_CANDIDATE");
        verify(notifications).notify(eq(adminId), eq("PROPOSAL"), eq("Proposal could not be assigned"), anyString(),
                eq("Proposal"), eq(proposalId));
    }

    @Test
    void startingScrutinyMarksTheExistingAssignmentInProgress() {
        ProposalAssignment open = new ProposalAssignment(proposalId, ProposalAssignment.STAGE_SCRUTINY, officerId,
                "SYSTEM", "existing", NOW.minusSeconds(3600), NOW.plusSeconds(3600));
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.of(open));

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.START_SCRUTINY, null, actor);

        assertThat(targeted).isFalse();
        assertThat(open.getStatus()).isEqualTo(ProposalAssignment.IN_PROGRESS);
        assertThat(open.getStartedAt()).isEqualTo(NOW);
    }

    @Test
    void startingScrutinyAsSomeoneElseReassignsTheStage() {
        ProposalAssignment open = new ProposalAssignment(proposalId, ProposalAssignment.STAGE_SCRUTINY, otherOfficerId,
                "SYSTEM", "existing", NOW.minusSeconds(3600), NOW.plusSeconds(3600));
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.of(open));

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.START_SCRUTINY, null, actor);

        assertThat(targeted).isTrue();
        assertThat(open.getStatus()).isEqualTo(ProposalAssignment.REASSIGNED);
        ArgumentCaptor<ProposalAssignment> saved = ArgumentCaptor.forClass(ProposalAssignment.class);
        verify(assignments, org.mockito.Mockito.times(3)).save(saved.capture());
        ProposalAssignment replacement = saved.getAllValues().get(2);
        assertThat(replacement.getAssignedUserId()).isEqualTo(officerId);
        assertThat(replacement.getStatus()).isEqualTo(ProposalAssignment.IN_PROGRESS);
        verify(audit).record(eq("REASSIGN"), eq("Proposal"), eq(proposalId), anyString());
    }

    // ------------------------------------------------------------------ decision routing

    @Test
    void aLargeProjectGoesToTheStateLevelAuthority() {
        stubRules("0", "100", "DISTRICT", "100", null, "STATE");
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.empty());
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_DECISION, OPEN)).thenReturn(Optional.empty());
        when(lookup.findRoutingCandidates("COMPETENT_AUTHORITY", districtId)).thenReturn(List.of(
                new RoutingCandidate(authorityId, "district-authority", "DISTRICT"),
                new RoutingCandidate(stateAuthorityId, "state-authority", "STATE")));

        boolean targeted = service.onTransition(proposal("150"), ProposalWorkflow.RECOMMEND, null, actor);

        ArgumentCaptor<ProposalAssignment> saved = ArgumentCaptor.forClass(ProposalAssignment.class);
        verify(assignments).save(saved.capture());
        assertThat(targeted).isTrue();
        assertThat(saved.getValue().getStage()).isEqualTo(ProposalAssignment.STAGE_DECISION);
        assertThat(saved.getValue().getAssignedUserId()).isEqualTo(stateAuthorityId);
    }

    @Test
    void aSmallProjectGoesToTheDistrictLevelAuthority() {
        stubRules("0", "100", "DISTRICT", "100", null, "STATE");
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.empty());
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_DECISION, OPEN)).thenReturn(Optional.empty());
        when(lookup.findRoutingCandidates("COMPETENT_AUTHORITY", districtId)).thenReturn(List.of(
                new RoutingCandidate(authorityId, "district-authority", "DISTRICT"),
                new RoutingCandidate(stateAuthorityId, "state-authority", "STATE")));

        service.onTransition(proposal("80"), ProposalWorkflow.RECOMMEND, null, actor);

        ArgumentCaptor<ProposalAssignment> saved = ArgumentCaptor.forClass(ProposalAssignment.class);
        verify(assignments).save(saved.capture());
        assertThat(saved.getValue().getAssignedUserId()).isEqualTo(authorityId);
    }

    @Test
    void theRecommenderIsNeverAssignedTheDecision() {
        stubRules("0", "100", "DISTRICT", "100", null, "STATE");
        Proposal proposal = proposal("80");
        proposal.setRecommendedByUserId(authorityId);
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_SCRUTINY, OPEN)).thenReturn(Optional.empty());
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_DECISION, OPEN)).thenReturn(Optional.empty());
        when(lookup.findRoutingCandidates("COMPETENT_AUTHORITY", districtId)).thenReturn(List.of(
                new RoutingCandidate(authorityId, "district-authority", "DISTRICT")));

        boolean targeted = service.onTransition(proposal, ProposalWorkflow.RECOMMEND, null, actor);

        assertThat(targeted).isFalse();
        verify(assignments, never()).save(any());
    }

    @Test
    void aDecisionClosesOpenStageAndDoesNotNotify() {
        ProposalAssignment open = new ProposalAssignment(proposalId, ProposalAssignment.STAGE_DECISION, authorityId,
                "SYSTEM", "existing", NOW.minusSeconds(3600), NOW.plusSeconds(3600));
        when(assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                proposalId, ProposalAssignment.STAGE_DECISION, OPEN)).thenReturn(Optional.of(open));

        boolean targeted = service.onTransition(proposal("80"), ProposalWorkflow.APPROVE, null, actor);

        assertThat(targeted).isFalse();
        assertThat(open.getStatus()).isEqualTo(ProposalAssignment.COMPLETED);
        assertThat(open.getCompletedAt()).isEqualTo(NOW);
        verify(notifications, never()).notify(any(), anyString(), anyString(), anyString(), anyString(), any());
        verify(audit).record("AUTO_COMPLETE", "Proposal", proposalId, "stage=DECISION");
    }

    // ------------------------------------------------------------------ helpers

    private Proposal proposal(String areaHa) {
        Proposal proposal = new Proposal();
        ReflectionTestUtils.setField(proposal, "id", proposalId);
        proposal.setTitle("Test project");
        proposal.setProposalNumber("PRP-2026-000001");
        proposal.setProjectType(ProjectType.STATE_HIGHWAY);
        proposal.setStatus(ProposalStatus.SUBMITTED);
        proposal.setOwnerUserId(ownerId);
        proposal.setDistrictId(districtId);
        proposal.setEstimatedLandAreaHa(new BigDecimal(areaHa));
        return proposal;
    }

    private static RoutingRule rule(String min, String max, String level) {
        RoutingRule rule = mock(RoutingRule.class);
        lenient().when(rule.isActive()).thenReturn(true);
        lenient().when(rule.getMinAreaHa()).thenReturn(min == null ? null : new BigDecimal(min));
        lenient().when(rule.getMaxAreaHa()).thenReturn(max == null ? null : new BigDecimal(max));
        lenient().when(rule.getDecisionLevel()).thenReturn(level);
        return rule;
    }

    private void stubRules(String min1, String max1, String level1, String min2, String max2, String level2) {
        RoutingRule first = rule(min1, max1, level1);
        RoutingRule second = rule(min2, max2, level2);
        when(rules.findByActiveTrueOrderByMinAreaHaAsc()).thenReturn(List.of(first, second));
    }
}
