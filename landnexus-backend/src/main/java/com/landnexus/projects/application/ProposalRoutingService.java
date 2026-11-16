package com.landnexus.projects.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.RoutingCandidate;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalAssignment;
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
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * NLAMS automatic routing. It is called inside the proposal transition transaction, after the status change has
 * been saved. It never changes the proposal status and it never fails a transition because no candidate exists:
 * in that case it records UNASSIGNED, keeps the existing broadcast notification and notifies the district admins.
 *
 * Candidate order: fewest open assignments, then username. The owner and (for the decision) the recommender are
 * always excluded. The DEMO routing rules use 100 ha: up to and including 100 ha is a DISTRICT decision, above is STATE.
 */
@Service
public class ProposalRoutingService {

    private static final String SCRUTINY_ITEM = "PROPOSAL_AWAITING_SCRUTINY";
    private static final int DEFAULT_WARNING_HOURS = 120;
    private static final Collection<String> OPEN = List.of(ProposalAssignment.PENDING, ProposalAssignment.IN_PROGRESS);

    private final ProposalAssignmentRepository assignments;
    private final RoutingRuleRepository rules;
    private final AdministrationLookupService lookup;
    private final NotificationService notifications;
    private final SlaLookupService sla;
    private final AuditService audit;
    private final Clock clock;

    public ProposalRoutingService(ProposalAssignmentRepository assignments, RoutingRuleRepository rules,
                                  AdministrationLookupService lookup, NotificationService notifications,
                                  SlaLookupService sla, AuditService audit, Clock clock) {
        this.assignments = assignments;
        this.rules = rules;
        this.lookup = lookup;
        this.notifications = notifications;
        this.sla = sla;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * Applies the routing side effects of a successful proposal transition.
     * Returns true when a targeted assignment notification was sent (so the caller skips the broadcast).
     */
    @Transactional
    public boolean onTransition(Proposal proposal, String action, String reason, CurrentActor actor) {
        Instant now = clock.instant();
        return switch (action) {
            case ProposalWorkflow.SUBMIT, ProposalWorkflow.RESUBMIT -> assignScrutiny(proposal, actor, now);
            case ProposalWorkflow.START_SCRUTINY -> startScrutiny(proposal, actor, now);
            case ProposalWorkflow.REQUEST_CLARIFICATION, ProposalWorkflow.REJECT_SCRUTINY -> {
                complete(proposal, ProposalAssignment.STAGE_SCRUTINY, now);
                yield false;
            }
            case ProposalWorkflow.RECOMMEND -> {
                complete(proposal, ProposalAssignment.STAGE_SCRUTINY, now);
                yield assignDecision(proposal, actor, now);
            }
            case ProposalWorkflow.APPROVE, ProposalWorkflow.REJECT -> {
                complete(proposal, ProposalAssignment.STAGE_DECISION, now);
                yield false;
            }
            default -> false;
        };
    }

    // ------------------------------------------------------------------ stages

    private boolean assignScrutiny(Proposal proposal, CurrentActor actor, Instant now) {
        if (openAssignment(proposal.getId(), ProposalAssignment.STAGE_SCRUTINY).isPresent()) {
            return false;
        }
        List<RoutingCandidate> candidates = lookup.findRoutingCandidates("SCRUTINY_OFFICER", proposal.getDistrictId());
        Optional<RoutingCandidate> picked = leastLoaded(candidates, candidate ->
                !candidate.id().equals(proposal.getOwnerUserId()));
        if (picked.isEmpty()) {
            unassigned(proposal, ProposalAssignment.STAGE_SCRUTINY);
            return false;
        }
        RoutingCandidate candidate = picked.get();
        create(proposal, ProposalAssignment.STAGE_SCRUTINY, candidate.id(), actor.username(),
                "Scrutiny routing: least-loaded scrutiny officer in the district", now);
        notifications.notify(candidate.id(), "PROPOSAL", "Proposal assigned to you",
                "Proposal " + label(proposal) + " is waiting for scrutiny in your district.",
                "Proposal", proposal.getId());
        audit.record("AUTO_ASSIGN", "Proposal", proposal.getId(),
                "stage=SCRUTINY, userId=" + candidate.id());
        return true;
    }

    private boolean startScrutiny(Proposal proposal, CurrentActor actor, Instant now) {
        Optional<ProposalAssignment> open = openAssignment(proposal.getId(), ProposalAssignment.STAGE_SCRUTINY);
        if (open.isEmpty()) {
            // Routing was not possible at submission time: the officer who starts is the assignee.
            create(proposal, ProposalAssignment.STAGE_SCRUTINY, actor.userId(), "SYSTEM",
                    "Assigned when scrutiny started (no earlier candidate)", now);
            ProposalAssignment created = assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
                    proposal.getId(), ProposalAssignment.STAGE_SCRUTINY, OPEN).orElseThrow();
            markInProgress(created, now);
            audit.record("AUTO_ASSIGN", "Proposal", proposal.getId(),
                    "stage=SCRUTINY, userId=" + actor.userId() + ", note=AT_START_SCRUTINY");
            return false;
        }

        ProposalAssignment assignment = open.get();
        if (assignment.getAssignedUserId().equals(actor.userId())) {
            markInProgress(assignment, now);
            return false;
        }
        assignment.setStatus(ProposalAssignment.REASSIGNED);
        assignment.setCompletedAt(now);
        // Flush the status change before inserting the replacement: the partial unique index allows only one
        // open assignment per proposal/stage, and Hibernate would otherwise insert before the UPDATE runs.
        assignments.saveAndFlush(assignment);
        ProposalAssignment replacement = create(proposal, ProposalAssignment.STAGE_SCRUTINY, actor.userId(),
                actor.username(), "Reassigned to the officer who started scrutiny", now);
        markInProgress(replacement, now);
        audit.record("REASSIGN", "Proposal", proposal.getId(),
                "stage=SCRUTINY, fromUserId=" + assignment.getAssignedUserId() + ", toUserId=" + actor.userId());
        return true;
    }

    private boolean assignDecision(Proposal proposal, CurrentActor actor, Instant now) {
        if (openAssignment(proposal.getId(), ProposalAssignment.STAGE_DECISION).isPresent()) {
            return false;
        }
        Optional<RoutingRule> rule = matchingRule(proposal);
        String level = rule.map(RoutingRule::getDecisionLevel).orElse("STATE");
        List<RoutingCandidate> candidates = lookup.findRoutingCandidates("COMPETENT_AUTHORITY", proposal.getDistrictId());
        Optional<RoutingCandidate> picked = leastLoaded(candidates, candidate ->
                !candidate.id().equals(proposal.getOwnerUserId())
                        && !candidate.id().equals(proposal.getRecommendedByUserId())
                        && levelAllowed(level, candidate.scopeLevel()));
        if (picked.isEmpty()) {
            unassigned(proposal, ProposalAssignment.STAGE_DECISION);
            return false;
        }
        RoutingCandidate candidate = picked.get();
        String note = rule.map(r -> "Decision routing: " + r.getName() + " (" + r.getDecisionLevel() + ")")
                .orElse("Decision routing: no matching rule, defaulted to STATE");
        create(proposal, ProposalAssignment.STAGE_DECISION, candidate.id(), "SYSTEM", note, now);
        notifications.notify(candidate.id(), "PROPOSAL", "Proposal assigned to you",
                "Proposal " + label(proposal) + " was recommended and awaits your decision.",
                "Proposal", proposal.getId());
        audit.record("AUTO_ASSIGN", "Proposal", proposal.getId(),
                "stage=DECISION, userId=" + candidate.id() + ", level=" + level);
        return true;
    }

    static boolean levelAllowed(String required, String actual) {
        return switch (required) {
            case "DISTRICT" -> "DISTRICT".equals(actual);
            case "CENTRAL" -> "CENTRAL".equals(actual);
            default -> "STATE".equals(actual) || "CENTRAL".equals(actual);
        };
    }

    /**
     * Among the rules whose area band and project type match: a project-type-specific rule wins, then the smallest
     * upper bound wins. Up to and including the upper bound matches; a null upper bound means above every finite bound.
     */
    static Optional<RoutingRule> matchingRule(List<RoutingRule> activeRules, String projectType, BigDecimal area) {
        BigDecimal value = area == null ? BigDecimal.ZERO : area;
        return activeRules.stream()
                .filter(RoutingRule::isActive)
                .filter(rule -> rule.getProjectType() == null || rule.getProjectType().equals(projectType))
                .filter(rule -> rule.getMinAreaHa() == null || value.compareTo(rule.getMinAreaHa()) >= 0)
                .filter(rule -> rule.getMaxAreaHa() == null || value.compareTo(rule.getMaxAreaHa()) <= 0)
                .min(Comparator
                        .comparing((RoutingRule rule) -> rule.getProjectType() == null ? 1 : 0)
                        .thenComparing(rule -> rule.getMaxAreaHa() == null ? Integer.MAX_VALUE : 0)
                        .thenComparing(rule -> rule.getMaxAreaHa() == null ? BigDecimal.ZERO : rule.getMaxAreaHa(),
                                Comparator.reverseOrder())
                        .thenComparing(rule -> rule.getMinAreaHa() == null ? BigDecimal.ZERO : rule.getMinAreaHa(),
                                Comparator.reverseOrder()));
    }

    private Optional<RoutingRule> matchingRule(Proposal proposal) {
        return matchingRule(rules.findByActiveTrueOrderByMinAreaHaAsc(),
                proposal.getProjectType().name(), proposal.getEstimatedLandAreaHa());
    }

    // ------------------------------------------------------------------ helpers

    private Optional<ProposalAssignment> openAssignment(UUID proposalId, String stage) {
        return assignments.findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(proposalId, stage, OPEN);
    }

    private ProposalAssignment create(Proposal proposal, String stage, UUID userId, String assignedBy, String note,
                                      Instant now) {
        int hours = sla.warningHours(SCRUTINY_ITEM).orElse(DEFAULT_WARNING_HOURS);
        Instant dueAt = now.plus(hours, ChronoUnit.HOURS);
        return assignments.save(new ProposalAssignment(proposal.getId(), stage, userId, assignedBy, note, now, dueAt));
    }

    private void markInProgress(ProposalAssignment assignment, Instant now) {
        assignment.setStatus(ProposalAssignment.IN_PROGRESS);
        assignment.setStartedAt(now);
        assignments.save(assignment);
    }

    private void complete(Proposal proposal, String stage, Instant now) {
        openAssignment(proposal.getId(), stage).ifPresent(assignment -> {
            assignment.setStatus(ProposalAssignment.COMPLETED);
            assignment.setCompletedAt(now);
            assignments.save(assignment);
            audit.record("AUTO_COMPLETE", "Proposal", proposal.getId(), "stage=" + stage);
        });
    }

    private void unassigned(Proposal proposal, String stage) {
        audit.record("UNASSIGNED", "Proposal", proposal.getId(),
                "stage=" + stage + ", reason=NO_ELIGIBLE_CANDIDATE");
        for (var admin : lookup.findUsersByRoleWithDistrictAccess("DISTRICT_ADMIN", proposal.getDistrictId())) {
            notifications.notify(admin.id(), "PROPOSAL", "Proposal could not be assigned",
                    "Proposal " + label(proposal) + " could not be assigned automatically. Check the routing rules and user scopes.",
                    "Proposal", proposal.getId());
        }
    }

    private Optional<RoutingCandidate> leastLoaded(List<RoutingCandidate> candidates,
                                                    java.util.function.Predicate<RoutingCandidate> allowed) {
        Map<UUID, Long> load = assignments.openAssignmentCounts().stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> ((Number) row[1]).longValue(), (a, b) -> a));
        return candidates.stream()
                .filter(allowed)
                .sorted(Comparator.comparingLong((RoutingCandidate c) -> load.getOrDefault(c.id(), 0L))
                        .thenComparing(RoutingCandidate::username))
                .findFirst();
    }

    private static String label(Proposal proposal) {
        return proposal.getProposalNumber() != null ? proposal.getProposalNumber() : proposal.getTitle();
    }
}
