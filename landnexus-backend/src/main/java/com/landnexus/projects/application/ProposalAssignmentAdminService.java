package com.landnexus.projects.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.RoutingCandidate;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.AssignmentDtos.AssignmentResponse;
import com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentCandidate;
import com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentRequest;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalAssignment;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.infrastructure.ProposalAssignmentRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.projects.infrastructure.RoutingRuleRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Audited reassignment of an open proposal task to an eligible officer in the proposal's district. */
@Service
@Transactional(readOnly = true)
public class ProposalAssignmentAdminService {

    private static final String MANAGE = "PROPOSAL_ASSIGNMENT_MANAGE";
    private static final String SCRUTINY = ProposalAssignment.STAGE_SCRUTINY;
    private static final String DECISION = ProposalAssignment.STAGE_DECISION;
    private static final Collection<String> OPEN = List.of(ProposalAssignment.PENDING, ProposalAssignment.IN_PROGRESS);

    private final ProposalRepository proposals;
    private final ProposalAssignmentRepository assignments;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final RoutingRuleRepository rules;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public ProposalAssignmentAdminService(ProposalRepository proposals, ProposalAssignmentRepository assignments,
                                          AdministrationLookupService lookup, GeoScopeService geoScope,
                                          RoutingRuleRepository rules,
                                          NotificationService notifications, AuditService audit, Clock clock) {
        this.proposals = proposals;
        this.assignments = assignments;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.rules = rules;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    public List<ReassignmentCandidate> candidates(UUID proposalId, String stage, CurrentActor actor) {
        requireManager(actor);
        Proposal proposal = findProposal(proposalId);
        requireDistrict(proposal, actor);
        validateStageOpen(proposal, stage);
        return eligibleCandidates(proposal, stage).stream()
                .map(c -> new ReassignmentCandidate(c.id(), c.username(), c.scopeLevel()))
                .toList();
    }

    @Transactional
    public AssignmentResponse reassign(UUID proposalId, UUID assignmentId, ReassignmentRequest request, CurrentActor actor) {
        requireManager(actor);
        Proposal proposal = findProposal(proposalId);
        requireDistrict(proposal, actor);
        ProposalAssignment current = assignments.findById(assignmentId)
                .filter(a -> a.getProposalId().equals(proposalId))
                .orElseThrow(() -> new ResourceNotFoundException("Open proposal assignment not found"));
        validateStageOpen(proposal, current.getStage());
        if (!OPEN.contains(current.getStatus())) {
            throw new InvalidTransitionException("Only an open proposal assignment can be reassigned");
        }
        String reason = request.reason().trim();
        if (reason.isEmpty()) {
            throw new InvalidRequestException("A reassignment reason is required");
        }
        RoutingCandidate candidate = eligibleCandidates(proposal, current.getStage()).stream()
                .filter(c -> c.id().equals(request.assignedUserId()))
                .findFirst()
                .orElseThrow(() -> new InvalidRequestException(
                        "The selected officer is not enabled, authorized for this stage, and in the proposal's geographic scope"));
        if (candidate.id().equals(current.getAssignedUserId())) {
            throw new InvalidRequestException("The selected officer is already assigned to this task");
        }

        Instant now = clock.instant();
        UUID previousUserId = current.getAssignedUserId();
        current.setStatus(ProposalAssignment.REASSIGNED);
        current.setCompletedAt(now);
        assignments.saveAndFlush(current);

        ProposalAssignment replacement = assignments.save(new ProposalAssignment(proposalId, current.getStage(),
                candidate.id(), actor.username(), "Manual reassignment: " + reason, now, current.getDueAt()));
        notifications.notify(candidate.id(), "PROPOSAL", "Proposal task reassigned to you",
                "Proposal " + label(proposal) + " was assigned to you. Reason: " + reason,
                "Proposal", proposalId);
        audit.record("MANUAL_REASSIGN", "Proposal", proposalId,
                "stage=" + current.getStage() + ", assignmentId=" + current.getId()
                        + ", fromUserId=" + previousUserId + ", toUserId=" + candidate.id()
                        + ", reason=" + reason);
        return response(replacement, candidate.username(), now);
    }

    private List<RoutingCandidate> eligibleCandidates(Proposal proposal, String stage) {
        String role = SCRUTINY.equals(stage) ? "SCRUTINY_OFFICER" : "COMPETENT_AUTHORITY";
        List<RoutingCandidate> candidates = lookup.findRoutingCandidates(role, proposal.getDistrictId()).stream()
                .filter(c -> !c.id().equals(proposal.getOwnerUserId()))
                .toList();
        if (SCRUTINY.equals(stage)) {
            return candidates;
        }
        if (proposal.getRecommendedByUserId() != null) {
            candidates = candidates.stream().filter(c -> !c.id().equals(proposal.getRecommendedByUserId())).toList();
        }
        String decisionLevel = ProposalRoutingService.matchingRule(
                        rules.findByActiveTrueOrderByMinAreaHaAsc(), proposal.getProjectType().name(),
                        proposal.getEstimatedLandAreaHa())
                .map(rule -> rule.getDecisionLevel()).orElse("STATE");
        return candidates.stream()
                .filter(c -> ProposalRoutingService.levelAllowed(decisionLevel, c.scopeLevel()))
                .toList();
    }

    private void validateStageOpen(Proposal proposal, String stage) {
        if (SCRUTINY.equals(stage)) {
            if (proposal.getStatus() != ProposalStatus.SUBMITTED && proposal.getStatus() != ProposalStatus.UNDER_SCRUTINY) {
                throw new InvalidTransitionException("Scrutiny can be reassigned only while the proposal awaits scrutiny");
            }
            return;
        }
        if (DECISION.equals(stage)) {
            if (proposal.getStatus() != ProposalStatus.RECOMMENDED) {
                throw new InvalidTransitionException("Decision can be reassigned only while the proposal awaits a decision");
            }
            return;
        }
        throw new InvalidRequestException("The assignment stage must be SCRUTINY or DECISION");
    }

    private Proposal findProposal(UUID proposalId) {
        return proposals.findById(proposalId)
                .orElseThrow(() -> new ResourceNotFoundException("Proposal not found: " + proposalId));
    }

    private void requireDistrict(Proposal proposal, CurrentActor actor) {
        geoScope.requireDistrictAccess(actor, proposal.getDistrictId());
    }

    private static void requireManager(CurrentActor actor) {
        if (!actor.hasAuthority(MANAGE)) {
            throw new AccessDeniedException("Proposal assignment management permission is required");
        }
    }

    private AssignmentResponse response(ProposalAssignment assignment, String username, Instant now) {
        Instant dueAt = assignment.getDueAt();
        return new AssignmentResponse(assignment.getId(), assignment.getProposalId(), assignment.getStage(),
                assignment.getAssignedUserId(), username, assignment.getAssignedBy(), assignment.getRuleNote(),
                assignment.getStatus(), assignment.getAssignedAt(), assignment.getStartedAt(),
                assignment.getCompletedAt(), dueAt, dueAt != null && dueAt.isBefore(now));
    }

    private static String label(Proposal proposal) {
        return proposal.getProposalNumber() == null ? proposal.getTitle() : proposal.getProposalNumber();
    }
}
