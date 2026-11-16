package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.RoutingCandidate;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentRequest;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalAssignment;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.infrastructure.ProposalAssignmentRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.projects.infrastructure.RoutingRuleRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
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

@ExtendWith(MockitoExtension.class)
class ProposalAssignmentAdminServiceTest {

    private static final UUID PROPOSAL_ID = UUID.randomUUID();
    private static final UUID DISTRICT_ID = UUID.randomUUID();
    private static final UUID ASSIGNMENT_ID = UUID.randomUUID();
    private static final UUID PREVIOUS_USER_ID = UUID.randomUUID();
    private static final UUID NEXT_USER_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-15T12:00:00Z");

    @Mock ProposalRepository proposals;
    @Mock ProposalAssignmentRepository assignments;
    @Mock AdministrationLookupService lookup;
    @Mock GeoScopeService geoScope;
    @Mock RoutingRuleRepository rules;
    @Mock NotificationService notifications;
    @Mock AuditService audit;

    private ProposalAssignmentAdminService service;
    @Mock Proposal proposal;
    private CurrentActor manager;

    @BeforeEach
    void setUp() {
        service = new ProposalAssignmentAdminService(proposals, assignments, lookup, geoScope, rules,
                notifications, audit, Clock.fixed(NOW, ZoneOffset.UTC));
        when(proposal.getStatus()).thenReturn(ProposalStatus.UNDER_SCRUTINY);
        when(proposal.getDistrictId()).thenReturn(DISTRICT_ID);
        manager = new CurrentActor(UUID.randomUUID(), "admin", Set.of("DISTRICT_ADMIN"),
                Set.of("PROPOSAL_ASSIGNMENT_MANAGE"));
        when(proposals.findById(PROPOSAL_ID)).thenReturn(Optional.of(proposal));
    }

    @Test
    void candidates_areLimitedToEligibleOfficersWithinProposalDistrict() {
        when(proposal.getOwnerUserId()).thenReturn(UUID.randomUUID());
        when(lookup.findRoutingCandidates("SCRUTINY_OFFICER", DISTRICT_ID))
                .thenReturn(List.of(new RoutingCandidate(NEXT_USER_ID, "scrutiny.demo", "DISTRICT")));

        var candidates = service.candidates(PROPOSAL_ID, ProposalAssignment.STAGE_SCRUTINY, manager);

        assertThat(candidates).containsExactly(
                new com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentCandidate(
                        NEXT_USER_ID, "scrutiny.demo", "DISTRICT"));
        verify(geoScope).requireDistrictAccess(manager, DISTRICT_ID);
    }

    @Test
    void reassignmentClosesOldAssignmentPreservesDeadlineAndAuditsReason() {
        when(proposal.getOwnerUserId()).thenReturn(UUID.randomUUID());
        when(proposal.getTitle()).thenReturn("Demo proposal");
        when(lookup.findRoutingCandidates("SCRUTINY_OFFICER", DISTRICT_ID))
                .thenReturn(List.of(new RoutingCandidate(NEXT_USER_ID, "scrutiny.demo", "DISTRICT")));
        Instant deadline = NOW.plusSeconds(3600);
        ProposalAssignment current = new ProposalAssignment(PROPOSAL_ID, ProposalAssignment.STAGE_SCRUTINY,
                PREVIOUS_USER_ID, "SYSTEM", "automatic", NOW.minusSeconds(600), deadline);
        current.setStatus(ProposalAssignment.IN_PROGRESS);
        when(assignments.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(current));
        when(assignments.saveAndFlush(current)).thenReturn(current);
        when(assignments.save(any(ProposalAssignment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reassign(PROPOSAL_ID, ASSIGNMENT_ID,
                new ReassignmentRequest(NEXT_USER_ID, "Officer transfer approved"), manager);

        assertThat(current.getStatus()).isEqualTo(ProposalAssignment.REASSIGNED);
        assertThat(current.getCompletedAt()).isEqualTo(NOW);
        assertThat(result.assignedUserId()).isEqualTo(NEXT_USER_ID);
        assertThat(result.assignedUsername()).isEqualTo("scrutiny.demo");
        assertThat(result.dueAt()).isEqualTo(deadline);
        assertThat(result.ruleNote()).contains("Officer transfer approved");
        verify(notifications).notify(NEXT_USER_ID, "PROPOSAL", "Proposal task reassigned to you",
                "Proposal Demo proposal was assigned to you. Reason: Officer transfer approved", "Proposal", PROPOSAL_ID);
        verify(audit).record("MANUAL_REASSIGN", "Proposal", PROPOSAL_ID,
                "stage=SCRUTINY, assignmentId=" + current.getId()
                        + ", fromUserId=" + PREVIOUS_USER_ID + ", toUserId=" + NEXT_USER_ID
                        + ", reason=Officer transfer approved");
    }

    @Test
    void assignmentCannotBeReassignedAfterTheProposalLeavesItsStage() {
        when(proposal.getStatus()).thenReturn(ProposalStatus.APPROVED);
        ProposalAssignment current = new ProposalAssignment(PROPOSAL_ID, ProposalAssignment.STAGE_SCRUTINY,
                PREVIOUS_USER_ID, "SYSTEM", "automatic", NOW, NOW.plusSeconds(3600));
        when(assignments.findById(ASSIGNMENT_ID)).thenReturn(Optional.of(current));

        assertThatThrownBy(() -> service.reassign(PROPOSAL_ID, ASSIGNMENT_ID,
                new ReassignmentRequest(NEXT_USER_ID, "Transfer"), manager))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("awaits scrutiny");
    }
}
