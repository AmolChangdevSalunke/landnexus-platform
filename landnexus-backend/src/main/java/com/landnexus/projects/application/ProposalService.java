package com.landnexus.projects.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.DistrictRef;
import com.landnexus.administration.application.AdministrationLookupService.TalukaRef;
import com.landnexus.administration.application.AdministrationLookupService.UserRef;
import com.landnexus.administration.application.AdministrationLookupService.VillageRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.AssignmentDtos.AssignmentResponse;
import com.landnexus.projects.api.dto.AssignmentDtos.MyTaskResponse;
import com.landnexus.projects.api.dto.ProposalHistoryResponse;
import com.landnexus.projects.api.dto.ProposalRequest;
import com.landnexus.projects.api.dto.ProposalResponse;
import com.landnexus.projects.api.dto.ProposalVersionResponse;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.projects.domain.ProposalAssignment;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalStatusHistory;
import com.landnexus.projects.domain.ProposalVersion;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.projects.infrastructure.ProposalAssignmentRepository;
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
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
    private final ProposalAssignmentRepository assignmentRepository;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final ProposalAccess access;
    private final NotificationService notifications;
    private final AuditService audit;
    private final Clock clock;
    private final AcquisitionCaseInitiator acquisitionCaseInitiator;
    private final ProposalValidationService validationService;
    private final ProposalRoutingService routing;
    private final ProposalService self;

    @Autowired
    public ProposalService(ProposalRepository proposals, ProposalVersionRepository versions,
                           ProposalStatusHistoryRepository history, ProjectRepository projects,
                           ProposalAssignmentRepository assignmentRepository,
                           AdministrationLookupService lookup, GeoScopeService geoScope, ProposalAccess access,
                           NotificationService notifications, AuditService audit, Clock clock,
                           AcquisitionCaseInitiator acquisitionCaseInitiator,
                           ProposalValidationService validationService, ProposalRoutingService routing,
                           @Lazy ProposalService self) {
        this.proposals = proposals;
        this.versions = versions;
        this.history = history;
        this.projects = projects;
        this.assignmentRepository = assignmentRepository;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.access = access;
        this.notifications = notifications;
        this.audit = audit;
        this.clock = clock;
        this.acquisitionCaseInitiator = acquisitionCaseInitiator;
        this.validationService = validationService;
        this.routing = routing;
        this.self = self != null ? self : this;
    }

    ProposalService(ProposalRepository proposals, ProposalVersionRepository versions,
                    ProposalStatusHistoryRepository history, ProjectRepository projects,
                    ProposalAssignmentRepository assignmentRepository,
                    AdministrationLookupService lookup, GeoScopeService geoScope, ProposalAccess access,
                    NotificationService notifications, AuditService audit, Clock clock,
                    AcquisitionCaseInitiator acquisitionCaseInitiator,
                    ProposalValidationService validationService, ProposalRoutingService routing) {
        this(proposals, versions, history, projects, assignmentRepository, lookup, geoScope, access, notifications,
                audit, clock, acquisitionCaseInitiator, validationService, routing, null);
    }

    public ProposalValidationService.ValidationResult validate(UUID id, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        ProposalValidationService.ValidationResult result = validationService.validate(proposal);
        audit.record("VALIDATE", ENTITY, proposal.getId(), "passed=" + result.passed() + ", items=" + result.items().size());
        return result;
    }

    // ------------------------------------------------------------------ queries

    public ProposalResponse get(UUID id, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        Project project = proposal.getStatus() == ProposalStatus.APPROVED
                ? projects.findByProposalId(proposal.getId()).orElse(null)
                : null;
        String projectCode = project == null ? null : project.getCode();
        String acquisitionCaseNumber = project == null ? null
                : acquisitionCaseInitiator.findCaseNumberByProjectId(project.getId()).orElse(null);
        return toResponse(proposal, actor, projectCode, acquisitionCaseNumber);
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
        return PageResponse.from(result, p -> toResponse(p, actor, null, null));
    }

    public List<ProposalHistoryResponse> history(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        return history.findByProposalIdOrderByOccurredAtAsc(id).stream().map(ProposalHistoryResponse::from).toList();
    }

    public List<ProposalVersionResponse> versions(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        return versions.findByProposalIdOrderByVersionNoAsc(id).stream().map(ProposalVersionResponse::from).toList();
    }

    /** The routing history of one proposal (who was assigned which stage and when). */
    public List<AssignmentResponse> assignments(UUID id, CurrentActor actor) {
        loadVisible(id, actor);
        Map<UUID, String> usernames = new java.util.HashMap<>();
        return assignmentRepository.findByProposalIdOrderByAssignedAtAsc(id).stream()
                .map(a -> toAssignmentResponse(a, usernames))
                .toList();
    }

    /** Open assignments of the caller: the "my tasks" work queue, newest first. */
    public PageResponse<MyTaskResponse> myTasks(CurrentActor actor, int page, int size) {
        Page<ProposalAssignment> result = assignmentRepository.findByAssignedUserIdAndStatusIn(
                actor.userId(),
                List.of(ProposalAssignment.PENDING, ProposalAssignment.IN_PROGRESS),
                PageParams.ofDescending(page, size, "assignedAt"));
        List<UUID> proposalIds = result.getContent().stream().map(ProposalAssignment::getProposalId).distinct().toList();
        Map<UUID, Proposal> byId = new java.util.HashMap<>();
        for (Proposal proposal : proposals.findAllById(proposalIds)) {
            byId.put(proposal.getId(), proposal);
        }
        Map<UUID, String> districtNames = new java.util.HashMap<>();
        return PageResponse.from(result, a -> toMyTaskResponse(a, byId.get(a.getProposalId()), districtNames));
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
        return toResponse(saved, actor, null, null);
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
        return toResponse(saved, actor, null, null);
    }

    // ------------------------------------------------------------------ workflow actions

    public ProposalResponse transition(UUID id, String action, String reason, CurrentActor actor) {
        if (ProposalWorkflow.APPROVE.equals(action)) {
            return approveWithRecovery(id, reason, actor);
        }
        Proposal proposal = loadVisible(id, actor);
        return self.applyNonApproveInTransaction(proposal, action, reason, actor);
    }

    /** One "reject" endpoint: during scrutiny it is a scrutiny rejection, after a recommendation it is the decision. */
    public ProposalResponse reject(UUID id, String reason, CurrentActor actor) {
        Proposal proposal = loadVisible(id, actor);
        String action = switch (proposal.getStatus()) {
            case UNDER_SCRUTINY -> ProposalWorkflow.REJECT_SCRUTINY;
            case RECOMMENDED -> ProposalWorkflow.REJECT;
            default -> throw new InvalidTransitionException(
                    "A proposal can be rejected only during scrutiny or after a recommendation");
        };
        return self.applyNonApproveInTransaction(proposal, action, reason, actor);
    }

    @Transactional
    public ProposalResponse applyNonApproveInTransaction(Proposal proposal, String action, String reason, CurrentActor actor) {
        if (ProposalWorkflow.APPROVE.equals(action)) {
            throw new InvalidRequestException("Approval must use the approval flow");
        }
        return applyInCurrentTransaction(proposal, action, reason, actor);
    }

    /**
     * Approval attempt in its own transaction. On PostgreSQL a constraint violation aborts the transaction,
     * so this method must not perform recovery SELECTs after DataIntegrityViolationException; it lets the
     * exception propagate so the transaction rolls back, and recovery happens in a fresh transaction.
     */
    @Transactional
    public ProposalResponse approveAttemptInTransaction(UUID id, String reason, CurrentActor actor) {
        Proposal proposal = proposals.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proposal not found: " + id));
        // Re-check visibility/authorization after acquiring the lock.
        if (!access.canView(actor, proposal.getDistrictId(), proposal.getOwnerUserId())) {
            throw new ResourceNotFoundException("Proposal not found: " + id);
        }
        if (proposal.getStatus() == ProposalStatus.APPROVED) {
            return existingApprovedResultOrConflict(proposal, actor, false);
        }
        return applyInCurrentTransaction(proposal, ProposalWorkflow.APPROVE, reason, actor);
    }

    @Transactional(readOnly = true)
    public ProposalResponse loadApprovedResultInFreshTransaction(UUID id, CurrentActor actor) {
        Proposal proposal = proposals.findCurrentById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proposal not found: " + id));
        if (!access.canView(actor, proposal.getDistrictId(), proposal.getOwnerUserId())) {
            throw new ResourceNotFoundException("Proposal not found: " + id);
        }
        if (proposal.getStatus() == ProposalStatus.APPROVED) {
            return existingApprovedResultOrConflict(proposal, actor, true);
        }
        throw new InvalidTransitionException(
                "Approval could not be completed due to a concurrent conflicting change; retry if needed");
    }

    /**
     * Orchestrates approval with PostgreSQL-safe recovery: after a rolled-back attempt caused by a DB
     * constraint/lock conflict, resolve the outcome in a fresh transaction and return the existing
     * complete result when another request already committed approval (idempotent), without duplicating
     * history/audit/notifications. No recovery query runs inside an aborted transaction.
     */
    private ProposalResponse approveWithRecovery(UUID id, String reason, CurrentActor actor) {
        try {
            return self.approveAttemptInTransaction(id, reason, actor);
        } catch (ObjectOptimisticLockingFailureException ex) {
            return self.loadApprovedResultInFreshTransaction(id, actor);
        } catch (DataIntegrityViolationException ex) {
            // Constraint violation aborted the attempt transaction; perform idempotent read in a fresh transaction.
            return self.loadApprovedResultInFreshTransaction(id, actor);
        }
    }

    private ProposalResponse existingApprovedResultOrConflict(Proposal proposal, CurrentActor actor, boolean afterRecovery) {
        Project project = projects.findByProposalId(proposal.getId()).orElse(null);
        String projectCode = project == null ? null : project.getCode();
        String acquisitionCaseNumber = null;
        if (project != null) {
            try {
                acquisitionCaseNumber = acquisitionCaseInitiator.findCaseNumberByProjectId(project.getId()).orElse(null);
            } catch (InvalidTransitionException ex) {
                // Multiple existing cases (legacy duplicates) or other reconciliation conflict: fail clearly.
                if (ex.getMessage() != null && ex.getMessage().contains("Multiple acquisition cases")) {
                    throw ex;
                }
                throw ex;
            }
        }
        if (project != null && acquisitionCaseNumber != null) {
            return toResponse(proposal, actor, projectCode, acquisitionCaseNumber);
        }
        if (project != null && acquisitionCaseNumber == null) {
            // Project exists but case is missing (or cannot be resolved) - require explicit reconciliation.
            throw new InvalidTransitionException(
                    "Proposal is approved but acquisition case artifacts are incomplete; manual reconciliation is required");
        }
        if (afterRecovery) {
            throw new InvalidTransitionException(
                    "Proposal is approved but project artifacts are incomplete; manual reconciliation is required");
        }
        throw new InvalidTransitionException(
                "Proposal is approved but project/acquisition artifacts are incomplete; manual reconciliation is required");
    }

    private ProposalResponse applyInCurrentTransaction(Proposal proposal, String action, String reason, CurrentActor actor) {
        try {
            Transition<ProposalStatus> transition =
                    ProposalWorkflow.DEFINITION.require(proposal.getStatus(), action, actor.authorities(), reason);
            String denial = denialReason(proposal, transition, actor);
            if (denial != null) {
                throw new AccessDeniedException(denial);
            }

            // Reopening only returns a rejected proposal to editing. A proposal that already
            // produced a project must never be reopened: that would fork an approved outcome.
            if (ProposalWorkflow.REOPEN.equals(action) && projects.findByProposalId(proposal.getId()).isPresent()) {
                throw new InvalidTransitionException(
                        "This proposal already has a project and cannot be reopened");
            }

            boolean submitting = ProposalWorkflow.SUBMIT.equals(action)
                    || ProposalWorkflow.RESUBMIT.equals(action);
            if (submitting) {
                ProposalValidationService.ValidationResult validation = validationService.validate(proposal);
                long failures = validation.items().stream().filter(i -> "FAIL".equals(i.severity())).count();
                long warnings = validation.items().stream().filter(i -> "WARN".equals(i.severity())).count();
                if (validation.hasFailures()) {
                    audit.record("VALIDATION_FAILED", ENTITY, proposal.getId(),
                            "submission blocked; failures=" + failures + ", warnings=" + warnings);
                    throw new InvalidRequestException("Proposal validation failed. Resolve mandatory validation issues before submission.");
                }
                audit.record("VALIDATE", ENTITY, proposal.getId(),
                        "passed=true, failures=0, warnings=" + warnings);
            }

            Instant now = clock.instant();
            ProposalStatus from = proposal.getStatus();

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
            String acquisitionCaseNumber = null;
            if (ProposalWorkflow.APPROVE.equals(action)) {
                Project project = createOrReuseProject(saved, actor, now);
                projectCode = project.getCode();
                acquisitionCaseNumber = acquisitionCaseInitiator.initiateForApprovedProject(project, saved, actor)
                        .map(AcquisitionCaseInitiator.InitiatedCase::caseNumber)
                        .orElse(null);
            }

            history.save(new ProposalStatusHistory(saved.getId(), from, transition.to(), action,
                    actor.userId(), actor.username(), blankToNull(reason), now));
            audit.record(action, ENTITY, saved.getId(), "status: " + from + " -> " + transition.to()
                    + (blankToNull(reason) == null ? "" : ", reason: " + reason));
            boolean targeted = routing.onTransition(saved, action, blankToNull(reason), actor);
            notifyAfter(saved, action, projectCode, acquisitionCaseNumber, targeted, reason);
            return toResponse(saved, actor, projectCode, acquisitionCaseNumber);
        } catch (ObjectOptimisticLockingFailureException ex) {
            // Must not be swallowed for non-approval actions; for approval the orchestrator handles recovery after rollback.
            if (ProposalWorkflow.APPROVE.equals(action)) {
                throw ex;
            }
            throw new InvalidTransitionException(
                    "Proposal was changed by another request; reload and try again");
        } catch (DataIntegrityViolationException ex) {
            // Never query inside this transaction after a PostgreSQL constraint violation (transaction is aborted).
            // Propagate so the transaction rolls back; approval recovery runs in a fresh transaction outside.
            throw ex;
        }
    }

    private Project createOrReuseProject(Proposal proposal, CurrentActor actor, Instant now) {
        return projects.findByProposalId(proposal.getId()).orElseGet(() -> {
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
        });
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

    /**
     * Notifications after a successful transition. When routing already sent a targeted notification to the assigned
     * officer, the broad role broadcast is skipped (otherwise the assignee would get the same message twice).
     */
    private void notifyAfter(Proposal proposal, String action, String projectCode, String acquisitionCaseNumber,
                            boolean targetedAssignment, String reason) {
        String label = proposal.getProposalNumber() != null ? proposal.getProposalNumber() : proposal.getTitle();
        UUID id = proposal.getId();
        switch (action) {
            case ProposalWorkflow.SUBMIT, ProposalWorkflow.RESUBMIT -> {
                if (!targetedAssignment) {
                    notifyRole("SCRUTINY_OFFICER", proposal,
                            "Proposal awaiting scrutiny", "Proposal " + label + " (" + proposal.getTitle() + ") was submitted for scrutiny.");
                }
            }
            case ProposalWorkflow.START_SCRUTINY -> notifyUser(proposal.getOwnerUserId(), id,
                    "Scrutiny started", "Scrutiny of proposal " + label + " has started.");
            case ProposalWorkflow.REQUEST_CLARIFICATION -> notifyUser(proposal.getOwnerUserId(), id,
                    "Clarification requested", "Proposal " + label + " needs clarification. Update it and resubmit.");
            case ProposalWorkflow.RECOMMEND -> {
                if (!targetedAssignment) {
                    notifyRole("COMPETENT_AUTHORITY", proposal,
                            "Proposal awaiting decision", "Proposal " + label + " was recommended and awaits your decision.");
                }
            }
            case ProposalWorkflow.APPROVE -> {
                String msg = "Proposal " + label + " was approved. Project " + projectCode + " was created.";
                if (acquisitionCaseNumber != null) {
                    msg += " Acquisition case " + acquisitionCaseNumber + " was initiated.";
                }
                notifyUser(proposal.getOwnerUserId(), id, "Proposal approved", msg);
            }
            case ProposalWorkflow.REJECT, ProposalWorkflow.REJECT_SCRUTINY -> {
                String msg = "Proposal " + label + " was rejected.";
                if (reason != null && !reason.isBlank()) {
                    msg += " Reason: " + (reason.length() > 400 ? reason.substring(0, 400) + "..." : reason);
                }
                msg += " See the history for the full record.";
                notifyUser(proposal.getOwnerUserId(), id, "Proposal rejected", msg);
            }
            case ProposalWorkflow.REOPEN -> {
                String msg = "Proposal " + label + " was reopened for editing.";
                if (reason != null && !reason.isBlank()) {
                    msg += " Reason: " + (reason.length() > 400 ? reason.substring(0, 400) + "..." : reason);
                }
                msg += " It keeps its number and earlier versions; resubmitting creates a new version.";
                notifyUser(proposal.getOwnerUserId(), id, "Proposal reopened", msg);
            }
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

    private ProposalResponse toResponse(Proposal proposal, CurrentActor actor, String projectCode, String acquisitionCaseNumber) {
        return ProposalResponse.from(proposal, projectCode, acquisitionCaseNumber, availableActions(proposal, actor));
    }

    private AssignmentResponse toAssignmentResponse(ProposalAssignment a, Map<UUID, String> usernames) {
        String username = usernames.computeIfAbsent(a.getAssignedUserId(),
                id -> lookup.findUser(id).map(UserRef::username).orElse(null));
        return new AssignmentResponse(a.getId(), a.getProposalId(), a.getStage(), a.getAssignedUserId(), username,
                a.getAssignedBy(), a.getRuleNote(), a.getStatus(), a.getAssignedAt(), a.getStartedAt(),
                a.getCompletedAt(), a.getDueAt(), isOverdue(a));
    }

    private MyTaskResponse toMyTaskResponse(ProposalAssignment a, Proposal proposal, Map<UUID, String> districtNames) {
        String districtName = null;
        if (proposal != null) {
            districtName = districtNames.computeIfAbsent(proposal.getDistrictId(),
                    id -> lookup.findActiveDistrict(id).map(DistrictRef::name).orElse(null));
        }
        return new MyTaskResponse(a.getId(), a.getProposalId(),
                proposal == null ? null : proposal.getProposalNumber(),
                proposal == null ? null : proposal.getTitle(),
                a.getStage(), a.getStatus(),
                proposal == null ? null : proposal.getStatus().name(),
                a.getAssignedAt(), a.getDueAt(), isOverdue(a),
                proposal == null ? null : proposal.getEstimatedLandAreaHa(),
                proposal == null ? null : proposal.getDistrictId(), districtName,
                proposal == null || proposal.getProjectType() == null ? null : proposal.getProjectType().name());
    }

    /** Only open assignments can be overdue; a completed one keeps its due date for the record. */
    private boolean isOverdue(ProposalAssignment a) {
        return a.getDueAt() != null
                && (ProposalAssignment.PENDING.equals(a.getStatus()) || ProposalAssignment.IN_PROGRESS.equals(a.getStatus()))
                && a.getDueAt().isBefore(clock.instant());
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
