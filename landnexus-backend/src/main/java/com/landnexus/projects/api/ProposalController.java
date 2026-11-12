package com.landnexus.projects.api;

import com.landnexus.projects.api.dto.AssignmentDtos.AssignmentResponse;
import com.landnexus.projects.api.dto.AssignmentDtos.MyTaskResponse;
import com.landnexus.projects.api.dto.ProposalHistoryResponse;
import com.landnexus.projects.api.dto.ProposalRequest;
import com.landnexus.projects.api.dto.ProposalResponse;
import com.landnexus.projects.api.dto.ProposalValidationResponse;
import com.landnexus.projects.api.dto.ProposalVersionResponse;
import com.landnexus.projects.api.dto.TransitionRequest;
import com.landnexus.projects.application.ProposalService;
import com.landnexus.projects.application.ProposalValidationService;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProposalWorkflow;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Thin HTTP layer. The workflow rules, ownership and scope checks all live in ProposalService. */
@RestController
@RequestMapping("/api/v1/projects/proposals")
public class ProposalController {

    private static final String CAN_READ = "hasAnyAuthority('PROPOSAL_READ','PROPOSAL_READ_OWN')";

    private final ProposalService service;

    public ProposalController(ProposalService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('PROPOSAL_CREATE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProposalResponse create(@Valid @RequestBody ProposalRequest request, Authentication authentication) {
        return service.create(request, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping
    public PageResponse<ProposalResponse> list(@RequestParam(required = false) ProposalStatus status,
                                               @RequestParam(required = false) UUID districtId,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size,
                                               Authentication authentication) {
        return service.list(status, districtId, page, size, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}")
    public ProposalResponse get(@PathVariable UUID id, Authentication authentication) {
        return service.get(id, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_CREATE')")
    @PutMapping("/{id}")
    public ProposalResponse update(@PathVariable UUID id, @Valid @RequestBody ProposalRequest request,
                                   Authentication authentication) {
        return service.update(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}/history")
    public List<ProposalHistoryResponse> history(@PathVariable UUID id, Authentication authentication) {
        return service.history(id, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}/versions")
    public List<ProposalVersionResponse> versions(@PathVariable UUID id, Authentication authentication) {
        return service.versions(id, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}/assignments")
    public List<AssignmentResponse> assignments(@PathVariable UUID id, Authentication authentication) {
        return service.assignments(id, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/my-tasks")
    public PageResponse<MyTaskResponse> myTasks(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size,
                                                Authentication authentication) {
        return service.myTasks(CurrentActor.from(authentication), page, size);
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}/validation")
    public ProposalValidationResponse validation(@PathVariable UUID id, Authentication authentication) {
        ProposalValidationService.ValidationResult result = service.validate(id, CurrentActor.from(authentication));
        return new ProposalValidationResponse(id, result.passed(),
                result.items().stream()
                        .map(i -> new ProposalValidationResponse.Item(i.code(), i.severity(), i.message()))
                        .toList());
    }

    @PreAuthorize("hasAuthority('PROPOSAL_CREATE')")
    @PostMapping("/{id}/submit")
    public ProposalResponse submit(@PathVariable UUID id, Authentication authentication) {
        return service.transition(id, ProposalWorkflow.SUBMIT, null, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_CREATE')")
    @PostMapping("/{id}/resubmit")
    public ProposalResponse resubmit(@PathVariable UUID id, Authentication authentication) {
        return service.transition(id, ProposalWorkflow.RESUBMIT, null, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_SCRUTINIZE')")
    @PostMapping("/{id}/start-scrutiny")
    public ProposalResponse startScrutiny(@PathVariable UUID id, Authentication authentication) {
        return service.transition(id, ProposalWorkflow.START_SCRUTINY, null, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_SCRUTINIZE')")
    @PostMapping("/{id}/clarification")
    public ProposalResponse clarification(@PathVariable UUID id, @Valid @RequestBody TransitionRequest request,
                                          Authentication authentication) {
        return service.transition(id, ProposalWorkflow.REQUEST_CLARIFICATION, request.reason(),
                CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_SCRUTINIZE')")
    @PostMapping("/{id}/recommend")
    public ProposalResponse recommend(@PathVariable UUID id,
                                      @Valid @RequestBody(required = false) TransitionRequest request,
                                      Authentication authentication) {
        return service.transition(id, ProposalWorkflow.RECOMMEND, reasonOf(request), CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('PROPOSAL_DECIDE')")
    @PostMapping("/{id}/approve")
    public ProposalResponse approve(@PathVariable UUID id,
                                    @Valid @RequestBody(required = false) TransitionRequest request,
                                    Authentication authentication) {
        return service.transition(id, ProposalWorkflow.APPROVE, reasonOf(request), CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAnyAuthority('PROPOSAL_SCRUTINIZE','PROPOSAL_DECIDE')")
    @PostMapping("/{id}/reject")
    public ProposalResponse reject(@PathVariable UUID id, @Valid @RequestBody TransitionRequest request,
                                   Authentication authentication) {
        return service.reject(id, request.reason(), CurrentActor.from(authentication));
    }

    private static String reasonOf(TransitionRequest request) {
        return request == null ? null : request.reason();
    }
}
