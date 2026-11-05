package com.landnexus.projects.api;

import com.landnexus.projects.api.dto.ProjectResponse;
import com.landnexus.projects.application.ProjectService;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Projects are created only by approving a proposal, so this controller is read-only. */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private static final String CAN_READ = "hasAnyAuthority('PROPOSAL_READ','PROPOSAL_READ_OWN')";

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @PreAuthorize(CAN_READ)
    @GetMapping
    public PageResponse<ProjectResponse> list(@RequestParam(required = false) UUID districtId,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size,
                                              Authentication authentication) {
        return service.list(districtId, page, size, CurrentActor.from(authentication));
    }

    @PreAuthorize(CAN_READ)
    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable UUID id, Authentication authentication) {
        return service.get(id, CurrentActor.from(authentication));
    }
}
