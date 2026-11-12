package com.landnexus.acquisition.application;

import com.landnexus.acquisition.domain.AcquisitionCase;
import com.landnexus.acquisition.domain.AcquisitionTypes.AcquisitionFramework;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import com.landnexus.acquisition.domain.CaseStatusHistory;
import com.landnexus.acquisition.infrastructure.AcquisitionCaseRepository;
import com.landnexus.acquisition.infrastructure.CaseStatusHistoryRepository;
import com.landnexus.projects.application.AcquisitionCaseInitiator;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
import java.time.Year;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates the initial acquisition case automatically when a proposal is approved. */
@Service
public class ProposalApprovedCaseInitiator implements AcquisitionCaseInitiator {

    private static final String ENTITY = "AcquisitionCase";

    private final AcquisitionCaseRepository cases;
    private final CaseStatusHistoryRepository history;
    private final AuditService audit;
    private final Clock clock;

    public ProposalApprovedCaseInitiator(AcquisitionCaseRepository cases, CaseStatusHistoryRepository history,
                                         AuditService audit, Clock clock) {
        this.cases = cases;
        this.history = history;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public Optional<InitiatedCase> initiateForApprovedProject(Project project, Proposal proposal, CurrentActor actor) {
        AcquisitionCase existing = findSingleCaseOrFail(project.getId());
        if (existing != null) {
            return Optional.of(new InitiatedCase(existing.getId(), existing.getCaseNumber()));
        }

        // Create in the caller's transaction. A uniqueness violation must roll back this transaction;
        // recovery/lookup must happen only in a fresh transaction to avoid PostgreSQL "aborted transaction" errors.
        Long sequence = cases.nextNumber();
        AcquisitionCase c = new AcquisitionCase();
        c.setCaseNumber(String.format("ACQ-%d-%06d", Year.now(clock).getValue(), sequence));
        c.setProjectId(project.getId());
        c.setStateId(project.getStateId());
        c.setDistrictId(project.getDistrictId());
        c.setFramework(defaultFramework(project));
        c.setFrameworkNote("Auto-initiated after proposal approval" + (proposal.getProposalNumber() != null ? " (" + proposal.getProposalNumber() + ")" : ""));
        c.setDescription("Acquisition case initiated for approved project " + project.getCode() + ".");
        c.setStatus(CaseStatus.INITIATED);
        c.getVillageIds().addAll(project.getVillageIds());

        AcquisitionCase saved = cases.saveAndFlush(c);
        Instant now = clock.instant();
        history.save(new CaseStatusHistory(saved.getId(), null, CaseStatus.INITIATED, "AUTO_INITIATE",
                actor.userId(), actor.username(), "Initiated automatically on proposal approval", now));
        audit.record("AUTO_INITIATE", ENTITY, saved.getId(),
                "case=" + saved.getCaseNumber() + ", projectId=" + project.getId() + ", proposalId=" + proposal.getId());
        return Optional.of(new InitiatedCase(saved.getId(), saved.getCaseNumber()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findCaseNumberByProjectId(UUID projectId) {
        AcquisitionCase single = findSingleCaseOrFail(projectId);
        return single == null ? Optional.empty() : Optional.ofNullable(single.getCaseNumber());
    }

    /**
     * Returns the single case for the project, null if none, or throws if multiple exist.
     * Existing duplicate legacy data must be reconciled explicitly; we never pick one arbitrarily.
     */
    private AcquisitionCase findSingleCaseOrFail(UUID projectId) {
        List<AcquisitionCase> found = cases.findAllByProjectId(projectId);
        if (found.isEmpty()) {
            return null;
        }
        if (found.size() == 1) {
            return found.get(0);
        }
        throw new InvalidTransitionException(
                "Multiple acquisition cases exist for project " + projectId + "; manual reconciliation is required");
    }

    private static AcquisitionFramework defaultFramework(Project project) {
        return switch (project.getProjectType()) {
            case NATIONAL_HIGHWAY, EXPRESSWAY -> AcquisitionFramework.NATIONAL_HIGHWAYS_ACT_1956;
            case RAILWAY -> AcquisitionFramework.RAILWAYS_ACT_1989;
            default -> AcquisitionFramework.LARR_2013;
        };
    }
}
