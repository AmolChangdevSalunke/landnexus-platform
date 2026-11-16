package com.landnexus.projects.application;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.AdministrationLookupService.DistrictRef;
import com.landnexus.administration.application.AdministrationLookupService.TalukaRef;
import com.landnexus.administration.application.AdministrationLookupService.VillageRef;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.ProjectResponse;
import com.landnexus.projects.api.dto.ProjectUpdateRequest;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.ProjectStatus;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageParams;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Projects are created only when a proposal is approved, then managed from the project register.
 * Read visibility follows the proposal rules; changes need PROJECT_MANAGE in addition to visibility.
 */
@Service
public class ProjectService {

    public static final String MANAGE = "PROJECT_MANAGE";
    private static final String ENTITY = "Project";

    private final ProjectRepository projects;
    private final ProposalAccess access;
    private final AdministrationLookupService lookup;
    private final GeoScopeService geoScope;
    private final AuditService audit;

    public ProjectService(ProjectRepository projects, ProposalAccess access,
                          AdministrationLookupService lookup, GeoScopeService geoScope, AuditService audit) {
        this.projects = projects;
        this.access = access;
        this.lookup = lookup;
        this.geoScope = geoScope;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(UUID id, CurrentActor actor) {
        return ProjectResponse.from(loadVisible(id, actor));
    }

    @Transactional(readOnly = true)
    public PageResponse<ProjectResponse> list(UUID districtId, int page, int size, CurrentActor actor) {
        Specification<Project> spec = access.visibleTo(actor);
        if (districtId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("districtId"), districtId));
        }
        Page<Project> result = projects.findAll(spec, PageParams.ofDescending(page, size, "createdAt"));
        return PageResponse.from(result, ProjectResponse::from);
    }

    @Transactional
    public ProjectResponse update(UUID id, ProjectUpdateRequest request, CurrentActor actor) {
        requireManage(actor);
        Project project = loadVisible(id, actor);
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new InvalidTransitionException("A closed project cannot be changed; reopen it first");
        }
        if (request.projectType().isLinear() && request.lengthKm() == null) {
            throw new InvalidRequestException("Length (km) is required for roads, expressways and railways");
        }

        String before = describe(project);
        applyRequest(project, request, actor);
        Project saved = projects.saveAndFlush(project);
        audit.record("UPDATE", ENTITY, saved.getId(), "before: " + before + " | after: " + describe(saved));
        return ProjectResponse.from(saved);
    }

    @Transactional
    public ProjectResponse close(UUID id, CurrentActor actor) {
        requireManage(actor);
        Project project = loadVisible(id, actor);
        if (project.getStatus() == ProjectStatus.CLOSED) {
            throw new InvalidTransitionException("The project is already closed");
        }
        project.setStatus(ProjectStatus.CLOSED);
        Project saved = projects.saveAndFlush(project);
        audit.record("CLOSE", ENTITY, saved.getId(), "status: ACTIVE -> CLOSED, code=" + saved.getCode());
        return ProjectResponse.from(saved);
    }

    @Transactional
    public ProjectResponse reopen(UUID id, CurrentActor actor) {
        requireManage(actor);
        Project project = loadVisible(id, actor);
        if (project.getStatus() == ProjectStatus.ACTIVE) {
            throw new InvalidTransitionException("The project is already active");
        }
        project.setStatus(ProjectStatus.ACTIVE);
        Project saved = projects.saveAndFlush(project);
        audit.record("REOPEN", ENTITY, saved.getId(), "status: CLOSED -> ACTIVE, code=" + saved.getCode());
        return ProjectResponse.from(saved);
    }

    private Project loadVisible(UUID id, CurrentActor actor) {
        Project project = projects.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + id));
        if (!access.canView(actor, project.getDistrictId(), project.getOwnerUserId())) {
            throw new ResourceNotFoundException("Project not found: " + id);
        }
        return project;
    }

    private static void requireManage(CurrentActor actor) {
        if (!actor.hasAuthority(MANAGE)) {
            throw new AccessDeniedException("You do not have permission to change projects");
        }
    }

    /** Same reference checks as a proposal, including access to the (possibly new) district. */
    private void applyRequest(Project project, ProjectUpdateRequest request, CurrentActor actor) {
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

        project.setTitle(request.title().trim());
        project.setProjectType(request.projectType());
        project.setStateId(district.stateId());
        project.setDistrictId(district.id());
        project.setTalukaId(request.talukaId());
        project.setDepartmentId(request.departmentId());
        project.setLengthKm(request.lengthKm());
        project.setEstimatedLandAreaHa(request.estimatedLandAreaHa());
        project.getVillageIds().clear();
        project.getVillageIds().addAll(request.villageIds());
    }

    private static String describe(Project project) {
        return "code=" + project.getCode() + ", title=" + project.getTitle()
                + ", type=" + project.getProjectType() + ", status=" + project.getStatus()
                + ", districtId=" + project.getDistrictId() + ", talukaId=" + project.getTalukaId()
                + ", departmentId=" + project.getDepartmentId() + ", lengthKm=" + project.getLengthKm()
                + ", landAreaHa=" + project.getEstimatedLandAreaHa()
                + ", villageCount=" + project.getVillageIds().size();
    }
}
