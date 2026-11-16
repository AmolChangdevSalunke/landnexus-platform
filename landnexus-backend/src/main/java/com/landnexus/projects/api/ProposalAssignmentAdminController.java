package com.landnexus.projects.api;

import com.landnexus.projects.api.dto.AssignmentDtos.AssignmentResponse;
import com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentCandidate;
import com.landnexus.projects.api.dto.AssignmentDtos.ReassignmentRequest;
import com.landnexus.projects.application.ProposalAssignmentAdminService;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects/proposals/{proposalId}")
public class ProposalAssignmentAdminController {

    private final ProposalAssignmentAdminService service;

    public ProposalAssignmentAdminController(ProposalAssignmentAdminService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PROPOSAL_ASSIGNMENT_MANAGE')")
    @GetMapping("/reassignment-candidates")
    public List<ReassignmentCandidate> candidates(@PathVariable UUID proposalId, @RequestParam String stage,
                                                   Authentication authentication) {
        return service.candidates(proposalId, stage, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_ASSIGNMENT_MANAGE')")
    @PostMapping("/assignments/{assignmentId}/reassign")
    public AssignmentResponse reassign(@PathVariable UUID proposalId, @PathVariable UUID assignmentId,
                                       @Valid @RequestBody ReassignmentRequest request,
                                       Authentication authentication) {
        return service.reassign(proposalId, assignmentId, request, CurrentActor.from(authentication));
    }
}
