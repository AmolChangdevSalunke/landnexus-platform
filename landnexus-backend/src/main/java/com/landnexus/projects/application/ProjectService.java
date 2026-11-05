package com.landnexus.projects.application;

import com.landnexus.projects.api.dto.ProjectResponse;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read access to projects, with the same visibility rules as proposals. */
@Service
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projects;
    private final ProposalAccess access;

    public ProjectService(ProjectRepository projects, ProposalAccess access) {
        this.projects = projects;
        this.access = access;
    }

    public ProjectResponse get(UUID id, CurrentActor actor) {
        Project project = projects.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + id));
        if (!access.canView(actor, project.getDistrictId(), project.getOwnerUserId())) {
            throw new ResourceNotFoundException("Project not found: " + id);
        }
        return ProjectResponse.from(project);
    }

    public PageResponse<ProjectResponse> list(UUID districtId, int page, int size, CurrentActor actor) {
        Specification<Project> spec = access.visibleTo(actor);
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        Page<Project> result = projects.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, ProjectResponse::from);
    }
}
