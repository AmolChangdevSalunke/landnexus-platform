package com.landnexus.projects.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.DistrictRef;
import com.landnexus.administration.application.AdministrationLookupService.TalukaRef;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.AdministrationLookupService.VillageRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.ProposalHistoryResponse;
import com.landnexus.projects.api.dto.ProposalRequest;
import com.landnexus.projects.api.dto.ProposalResponse;
import com.landnexus.projects.api.dto.ProposalVersionResponse;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalStatusHistory;
import com.landnexus.projects.domain.ProposalVersion;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.projects.infrastructure.ProposalRepository;
import com.landnexus.projects.infrastructure.ProposalStatusHistoryRepository;
import com.landnexus.projects.infrastructure.ProposalVersionRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.notification.NotificationService;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.shared.workflow.Transition;
import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The proposal use cases. Every state change goes through the workflow table in ProposalWorkflow;
 * this class adds the rules the table cannot express (ownership, separation of duties, geographic scope).
 */
@Service
@Transactional(readOnly = true)
public class ProposalService {

    private static final String ENTITY = "Proposal";

    private final ProposalRepository proposals;
    private final ProposalVersionRepository versions;
    private final ProposalStatusHistoryRepository history;
    private final ProjectRepository projects;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final ProposalAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;

    public ProposalService(ProposalRepository proposals, ProposalVersionRepository versions,
                           ProposalStatusHistoryRepository history, ProjectRepository projects,
                           AdministrationLookupService lookup, GeoScopeService geoScope, ProposalAccess access,
                           NotificationService notifications, AuditService audit, Clock clock) {
        this.proposals = proposals;
        this.versions = versions;
        this.history = history;
        this.projects = projects;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ queries

    public ProposalResponse get(UUID id, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        String projectCode = proposal.getStatus() == ProposalStatus.APPROVED
                ? projects.findByProposalId(proposal.getId()).map(Project::getCode).orElse(null)
                : null;
        return toResponse(proposal, actor, projectCode);
    }

    public PageResponse<ProposalResponse> list(ProposalStatus status, UUID districtId, int page, int size,
                                               CurrentActor actor) {
        Specification<Proposal> spec = access.visibleTo(actor);
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        Page<Proposal> result = proposals.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, p -> toResponse(p, actor, null));
    }

    public List<ProposalHistoryResponse> history(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        return history.findByProposalIdOrderByOccurredAtAsc(id).stream().map(ProposalHistoryResponse::from).toList();
    }

    public List<ProposalVersionResponse> versions(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        return versions.findByProposalIdOrderByVersionNoAsc(id).stream().map(ProposalVersionResponse::from).toList();
    }

    // ------------------------------------------------------------------ consultant: create and edit

    @Transactional
    public ProposalResponse create(ProposalRequest request, CurrentActor actor) {
        Proposal proposal = new Proposal();
        proposal.setOwnerUserId(actor.userId());
        proposal.setStatus(ProposalStatus.DRAFT);
        applyRequest(proposal, request, actor);
        Proposal saved = proposals.saveAndFlush(proposal);
        history.save(new ProposalStatusHistory(saved.getId(), null, ProposalStatus.DRAFT, "CREATE",
                actor.userId(), actor.username(), null, clock.instant()));
        audit.record("CREATE", ENTITY, saved.getId(), describe(saved));
        return toResponse(saved, actor, null);
    }

    @Transactional
    public ProposalResponse update(UUID id, ProposalRequest request, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        requireOwner(proposal, actor);
        if (proposal.getStatus() != ProposalStatus.DRAFT
                && proposal.getStatus() != ProposalStatus.CLARIFICATION_REQUESTED) {
            throw new InvalidTransitionException(
                    "A proposal can be changed only while it is a draft or waiting for clarification");
        }
        String before = describe(proposal);
        applyRequest(proposal, request, actor);
        Proposal saved = proposals.saveAndFlush(proposal);
        audit.record("UPDATE", ENTITY, saved.getId(), "before: " + before + " | after: " + describe(saved));
        return toResponse(saved, actor, null);
    }

    // ------------------------------------------------------------------ workflow actions

    @Transactional
    public ProposalResponse transition(UUID id, String action, String reason, CurrentActor actor) {
        return apply(loadVisible(id, actor), action, reason, actor);
    }

    /** One "reject" endpoint: during scrutiny it is a scrutiny rejection, after a recommendation it is the decision. */
    @Transactional
    public ProposalResponse reject(UUID id, String reason, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        String action = switch (proposal.getStatus()) {
            case UNDER_SCRUTINY -> ProposalWorkflow.REJECT_SCRUTINY;
            case RECOMMENDED -> ProposalWorkflow.REJECT;
            default -> throw new InvalidTransitionException(
                    "A proposal can be rejected only during scrutiny or after a recommendation");
        };
        return apply(proposal, action, reason, actor);
    }

    private ProposalResponse apply(Proposal proposal, String action, String reason, CurrentActor actor) {
        Transition<ProposalStatus> transition =
                ProposalWorkflow.DEFINITION.require(proposal.getStatus(), action, actor.authorities(), reason);
        String denial = denialReason(proposal, transition, actor);
        if (denial != null) {
            throw new AccessDeniedException(denial);
        }

//        Instant now = clock.instant();
//        ProposalStatus from = proposal.getStatus();
//        proposal.setStatus(transition.to());
//
//        boolean submitting = ProposalWorkflow.SUBMIT.equals(action) || ProposalWorkflow.RESUBMIT.equals(action);
//        if (submitting) {
//            if (proposal.getProposalNumber() == null) {
//                proposal.setProposalNumber(String.format("PRP-%d-%06d", Year.now(clock).getValue(), proposals.nextNumber()));
//            }
//            proposal.setVersionNo(proposal.getVersionNo() + 1);
//            proposal.setSubmittedAt(now);
//        }

        Instant now = clock.instant();
        ProposalStatus from = proposal.getStatus();

        boolean submitting = ProposalWorkflow.SUBMIT.equals(action)
                || ProposalWorkflow.RESUBMIT.equals(action);

// Allocate the number BEFORE changing the status.
// The native sequence query can trigger Hibernate auto-flush.
        if (submitting && proposal.getProposalNumber() == null) {
            Long sequenceNumber = proposals.nextNumber();
            proposal.setProposalNumber(String.format(
                    "PRP-%d-%06d",
                    Year.now(clock).getValue(),
                    sequenceNumber
            ));
        }

// Now it is safe to change the status.
        proposal.setStatus(transition.to());

        if (submitting) {
            proposal.setVersionNo(proposal.getVersionNo() + 1);
            proposal.setSubmittedAt(now);
        }

        if (ProposalWorkflow.RECOMMEND.equals(action)) {
            proposal.setRecommendedByUserId(actor.userId());
        }

        Proposal saved = proposals.saveAndFlush(proposal);

        if (submitting) {
            versions.save(new ProposalVersion(saved.getId(), saved.getVersionNo(), snapshot(saved),
                    actor.userId(), actor.username(), now));
        }
        String projectCode = null;
        if (ProposalWorkflow.APPROVE.equals(action)) {
            Project project = createProject(saved, actor, now);
            projectCode = project.getCode();
        }

        history.save(new ProposalStatusHistory(saved.getId(), from, transition.to(), action,
                actor.userId(), actor.username(), blankToNull(reason), now));
        audit.record(action, ENTITY, saved.getId(), "status: " + from + " -> " + transition.to()
                + (blankToNull(reason) == null ? "" : ", reason: " + reason));
        notifyAfter(saved, action, projectCode);
        return toResponse(saved, actor, projectCode);
    }

    private Project createProject(Proposal proposal, CurrentActor actor, Instant now) {
        Project project = new Project();
        project.setCode(String.format("PRJ-%d-%06d", Year.now(clock).getValue(), projects.nextNumber()));
        project.setProposalId(proposal.getId());
        project.setTitle(proposal.getTitle());
        project.setProjectType(proposal.getProjectType());
        project.setStateId(proposal.getStateId());
        project.setDistrictId(proposal.getDistrictId());
        project.setTalukaId(proposal.getTalukaId());
        project.setDepartmentId(proposal.getDepartmentId());
        project.setLengthKm(proposal.getLengthKm());
        project.setEstimatedLandAreaHa(proposal.getEstimatedLandAreaHa());
        project.setOwnerUserId(proposal.getOwnerUserId());
        project.setApprovedByUserId(actor.userId());
        project.setApprovedAt(now);
        project.getVillageIds().addAll(proposal.getVillageIds());
        Project saved = projects.saveAndFlush(project);
        audit.record("CREATE", "Project", saved.getId(),
                "code=" + saved.getCode() + ", fromProposal=" + proposal.getId());
        return saved;
    }

    // ------------------------------------------------------------------ rules

    /** Rules beyond the workflow table; null means allowed. */
    private static String denialReason(Proposal proposal, Transition<ProposalStatus> transition, CurrentActor actor) {
        boolean owner = actor.userId().equals(proposal.getOwnerUserId());
        String action = transition.action();
        if (ProposalWorkflow.OWNER_ACTIONS.contains(action) && !owner) {
            return "Only the consultant who created the proposal can do this";
        }
        if (ProposalWorkflow.REVIEWER_ACTIONS.contains(action) && owner) {
            return "You cannot review your own proposal";
        }
        if (ProposalWorkflow.DECISION_ACTIONS.contains(action)
                && actor.userId().equals(proposal.getRecommendedByUserId())) {
            return "The officer who recommended a proposal cannot also decide it";
        }
        return null;
    }

    private List<String> availableActions(Proposal proposal, CurrentActor actor) {
        List<String> actions = new ArrayList<>();
        for (Transition<ProposalStatus> transition : ProposalWorkflow.DEFINITION.from(proposal.getStatus())) {
            if (actor.hasAuthority(transition.requiredAuthority())
                    && denialReason(proposal, transition, actor) == null) {
                actions.add(transition.action());
            }
        }
        return actions;
    }

    private Proposal loadVisible(UUID id, CurrentActor actor) {
        Proposal proposal = proposals.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proposal not found: " + id));
        if (!access.canView(actor, proposal.getDistrictId(), proposal.getOwnerUserId())) {
            throw new ResourceNotFoundException("Proposal not found: " + id);
        }
        return proposal;
    }

    private static void requireOwner(Proposal proposal, CurrentActor actor) {
        if (!actor.userId().equals(proposal.getOwnerUserId())) {
            throw new AccessDeniedException("Only the consultant who created the proposal can change it");
        }
    }

    /** Cheap checks first, then every reference is looked up through the administration module's published API. */
    private void applyRequest(Proposal proposal, ProposalRequest request, CurrentActor actor) {
        if (request.projectType().isLinear() && request.lengthKm() == null) {
            throw new InvalidRequestException("Length (km) is required for roads, expressways and railways");
        }
        if (!request.plannedEndDate().isAfter(request.plannedStartDate())) {
            throw new InvalidRequestException("The planned end date must be after the planned start date");
        }

        DistrictRef district = lookup.findActiveDistrict(request.districtId())
                .orElseThrow(() -> new InvalidRequestException("Unknown or inactive district: " + request.districtId()));
        geoScope.requireDistrictAccess(actor, district.id());

        if (request.talukaId() != null) {
            TalukaRef taluka = lookup.findActiveTaluka(request.talukaId())
                    .orElseThrow(() -> new InvalidRequestException("Unknown or inactive taluka: " + request.talukaId()));
            if (!taluka.districtId().equals(district.id())) {
                throw new InvalidRequestException("The taluka does not belong to the selected district");
            }
        }
        if (!lookup.departmentIsActive(request.departmentId())) {
            throw new InvalidRequestException("Unknown or inactive department: " + request.departmentId());
        }
        List<VillageRef> villages = lookup.findActiveVillages(request.villageIds());
        if (villages.size() != request.villageIds().size()) {
            throw new InvalidRequestException("One or more villages are unknown or inactive");
        }
        for (VillageRef village : villages) {
            if (!village.districtId().equals(district.id())) {
                throw new InvalidRequestException("Village " + village.name() + " does not belong to the selected district");
            }
        }

        proposal.setTitle(request.title().trim());
        proposal.setProjectType(request.projectType());
        proposal.setStateId(district.stateId());
        proposal.setDistrictId(district.id());
        proposal.setTalukaId(request.talukaId());
        proposal.setDepartmentId(request.departmentId());
        proposal.setLengthKm(request.lengthKm());
        proposal.setEstimatedLandAreaHa(request.estimatedLandAreaHa());
        proposal.setAlignmentDescription(blankToNull(request.alignmentDescription()));
        proposal.setDescription(request.description().trim());
        proposal.setPlannedStartDate(request.plannedStartDate());
        proposal.setPlannedEndDate(request.plannedEndDate());
        proposal.getVillageIds().clear();
        proposal.getVillageIds().addAll(request.villageIds());
    }

    // ------------------------------------------------------------------ notifications

    private void notifyAfter(Proposal proposal, String action, String projectCode) {
        String label = proposal.getProposalNumber() != null ? proposal.getProposalNumber() : proposal.getTitle();
        UUID id = proposal.getId();
        switch (action) {
            case ProposalWorkflow.SUBMIT, ProposalWorkflow.RESUBMIT -> notifyRole("SCRUTINY_OFFICER", proposal,
                    "Proposal awaiting scrutiny", "Proposal " + label + " (" + proposal.getTitle() + ") was submitted.");
            case ProposalWorkflow.START_SCRUTINY -> notifyUser(proposal.getOwnerUserId(), id,
                    "Scrutiny started", "Scrutiny of proposal " + label + " has started.");
            case ProposalWorkflow.REQUEST_CLARIFICATION -> notifyUser(proposal.getOwnerUserId(), id,
                    "Clarification requested", "Proposal " + label + " needs clarification. Update it and resubmit.");
            case ProposalWorkflow.RECOMMEND -> notifyRole("COMPETENT_AUTHORITY", proposal,
                    "Proposal awaiting decision", "Proposal " + label + " was recommended and awaits your decision.");
            case ProposalWorkflow.APPROVE -> notifyUser(proposal.getOwnerUserId(), id,
                    "Proposal approved", "Proposal " + label + " was approved. Project " + projectCode + " was created.");
            case ProposalWorkflow.REJECT, ProposalWorkflow.REJECT_SCRUTINY -> notifyUser(proposal.getOwnerUserId(), id,
                    "Proposal rejected", "Proposal " + label + " was rejected. See the history for the reason.");
            default -> {
            }
        }
    }

    private void notifyRole(String roleCode, Proposal proposal, String title, String message) {
        for (UserRef user : lookup.findUsersByRoleWithDistrictAccess(roleCode, proposal.getDistrictId())) {
            notifyUser(user.id(), proposal.getId(), title, message);
        }
    }

    private void notifyUser(UUID userId, UUID proposalId, String title, String message) {
        notifications.notify(userId, "PROPOSAL", title, message, ENTITY, proposalId);
    }

    // ------------------------------------------------------------------ helpers

    private ProposalResponse toResponse(Proposal proposal, CurrentActor actor, String projectCode) {
        return ProposalResponse.from(proposal, projectCode, availableActions(proposal, actor));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String describe(Proposal p) {
        return "title=" + p.getTitle() + ", type=" + p.getProjectType() + ", status=" + p.getStatus()
                + ", districtId=" + p.getDistrictId() + ", landAreaHa=" + p.getEstimatedLandAreaHa();
    }

    /** A readable, frozen copy of the proposal for the version history. */
    private static String snapshot(Proposal p) {
        return String.join("\n",
                "title=" + p.getTitle(),
                "projectType=" + p.getProjectType(),
                "stateId=" + p.getStateId(),
                "districtId=" + p.getDistrictId(),
                "talukaId=" + p.getTalukaId(),
                "departmentId=" + p.getDepartmentId(),
                "lengthKm=" + p.getLengthKm(),
                "estimatedLandAreaHa=" + p.getEstimatedLandAreaHa(),
                "villageIds=" + new TreeSet<>(p.getVillageIds()),
                "alignment=" + p.getAlignmentDescription(),
                "plannedStartDate=" + p.getPlannedStartDate(),
                "plannedEndDate=" + p.getPlannedEndDate(),
                "description=" + p.getDescription());
    }
}
