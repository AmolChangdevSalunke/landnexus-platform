package com.landnexus.projects.application;

import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.Proposal;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.UUID;

/** Integration point: initiate the acquisition case when a proposal is approved and a project exists. */
public interface AcquisitionCaseInitiator {

    record InitiatedCase(UUID id, String caseNumber) {}

    Optional<InitiatedCase> initiateForApprovedProject(Project project, Proposal proposal, CurrentActor actor);

    /**
     * Returns the case number for the project's acquisition case, or empty if none exists.
     * Implementations must fail clearly if multiple cases exist for the same project (legacy duplicates);
     * they must not arbitrarily select one.
     */
    Optional<String> findCaseNumberByProjectId(UUID projectId);
}
