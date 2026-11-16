package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.application.AdministrationLookupService;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.projects.api.dto.ProjectResponse;
import com.landnexus.projects.api.dto.ProjectUpdateRequest;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.domain.ProjectStatus;
import com.landnexus.projects.domain.ProjectType;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidTransitionException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock private ProjectRepository projects;
    @Mock private ProposalAccess access;
    @Mock private AdministrationLookupService lookup;
    @Mock private GeoScopeService geoScope;
    @Mock private AuditService audit;

    private ProjectService service;

    private final CurrentActor actor = new CurrentActor(UUID.randomUUID(), "officer", Set.of("SCRUTINY_OFFICER"), Set.of("PROPOSAL_READ"));
    private final CurrentActor manager = new CurrentActor(UUID.randomUUID(), "district_admin", Set.of("DISTRICT_ADMIN"),
            Set.of("PROPOSAL_READ", "PROJECT_MANAGE"));

    @BeforeEach
    void setUp() {
        service = new ProjectService(projects, access, lookup, geoScope, audit);
    }

    private Project project(UUID id) {
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", id);
        project.setCode("PRJ-2026-000001");
        project.setTitle("Old title");
        project.setStatus(ProjectStatus.ACTIVE);
        project.setProjectType(ProjectType.SCHOOL);
        project.setStateId(UUID.randomUUID());
        project.setDistrictId(UUID.randomUUID());
        project.setDepartmentId(UUID.randomUUID());
        project.setEstimatedLandAreaHa(new BigDecimal("1.50"));
        project.setOwnerUserId(UUID.randomUUID());
        return project;
    }

    @Test
    void get_visibleProject_isReturned() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(actor, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);

        assertThat(service.get(id, actor).code()).isEqualTo("PRJ-2026-000001");
    }

    @Test
    void get_projectOutsideTheCallersView_isNotFound() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(actor, project.getDistrictId(), project.getOwnerUserId())).thenReturn(false);

        assertThatThrownBy(() -> service.get(id, actor)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void get_unknownProject_isNotFound() {
        UUID id = UUID.randomUUID();
        when(projects.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id, actor)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void list_appliesTheVisibilityFilter() {
        when(access.<Project>visibleTo(actor)).thenReturn((root, query, cb) -> cb.conjunction());
        when(projects.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(project(UUID.randomUUID()))));

        PageResponse<ProjectResponse> page = service.list(null, 0, 20, actor);

        assertThat(page.content()).hasSize(1);
    }

    @Test
    void update_withProjectManage_changesEditableFieldsAndAudits() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        UUID districtId = UUID.randomUUID();
        UUID stateId = UUID.randomUUID();
        UUID departmentId = UUID.randomUUID();
        UUID villageId = UUID.randomUUID();
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);
        when(lookup.findActiveDistrict(districtId)).thenReturn(Optional.of(
                new AdministrationLookupService.DistrictRef(districtId, "District", stateId)));
        when(lookup.departmentIsActive(departmentId)).thenReturn(true);
        when(lookup.findActiveVillages(Set.of(villageId))).thenReturn(List.of(
                new AdministrationLookupService.VillageRef(villageId, "Village", districtId)));
        when(projects.saveAndFlush(project)).thenReturn(project);

        ProjectResponse response = service.update(id, new ProjectUpdateRequest(
                " New title ", ProjectType.NATIONAL_HIGHWAY, districtId, null, departmentId,
                new BigDecimal("12.30"), new BigDecimal("3.40"), Set.of(villageId)), manager);

        assertThat(response.title()).isEqualTo("New title");
        assertThat(response.projectType()).isEqualTo(ProjectType.NATIONAL_HIGHWAY);
        assertThat(response.districtId()).isEqualTo(districtId);
        assertThat(response.stateId()).isEqualTo(stateId);
        assertThat(response.villageIds()).containsExactly(villageId);
        verify(audit).record(org.mockito.ArgumentMatchers.eq("UPDATE"), org.mockito.ArgumentMatchers.eq("Project"),
                org.mockito.ArgumentMatchers.eq(id), org.mockito.ArgumentMatchers.contains("New title"));
    }

    @Test
    void update_withoutProjectManage_isDeniedBeforeAnyRead() {
        UUID id = UUID.randomUUID();

        assertThatThrownBy(() -> service.update(id, new ProjectUpdateRequest(
                "Title", ProjectType.SCHOOL, UUID.randomUUID(), null, UUID.randomUUID(),
                null, BigDecimal.ONE, Set.of(UUID.randomUUID())), actor))
                .isInstanceOf(AccessDeniedException.class);
        verify(projects, never()).findById(any());
    }

    @Test
    void update_closedProject_isRejected() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        project.setStatus(ProjectStatus.CLOSED);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);

        assertThatThrownBy(() -> service.update(id, new ProjectUpdateRequest(
                "Title", ProjectType.SCHOOL, project.getDistrictId(), null, project.getDepartmentId(),
                null, BigDecimal.ONE, Set.of(UUID.randomUUID())), manager))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("closed");
    }

    @Test
    void close_activeProject_setsClosedAndAudits() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);
        when(projects.saveAndFlush(project)).thenReturn(project);

        ProjectResponse response = service.close(id, manager);

        assertThat(response.status()).isEqualTo(ProjectStatus.CLOSED);
        verify(audit).record("CLOSE", "Project", id, "status: ACTIVE -> CLOSED, code=PRJ-2026-000001");
    }

    @Test
    void close_closedProject_isRejected() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        project.setStatus(ProjectStatus.CLOSED);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);

        assertThatThrownBy(() -> service.close(id, manager))
                .isInstanceOf(InvalidTransitionException.class)
                .hasMessageContaining("already closed");
    }

    @Test
    void reopen_closedProject_setsActiveAndAudits() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        project.setStatus(ProjectStatus.CLOSED);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(true);
        when(projects.saveAndFlush(project)).thenReturn(project);

        ProjectResponse response = service.reopen(id, manager);

        assertThat(response.status()).isEqualTo(ProjectStatus.ACTIVE);
        verify(audit).record("REOPEN", "Project", id, "status: CLOSED -> ACTIVE, code=PRJ-2026-000001");
    }

    @Test
    void close_projectOutsideTheCallersView_isNotFound() {
        UUID id = UUID.randomUUID();
        Project project = project(id);
        when(projects.findById(id)).thenReturn(Optional.of(project));
        when(access.canView(manager, project.getDistrictId(), project.getOwnerUserId())).thenReturn(false);

        assertThatThrownBy(() -> service.close(id, manager)).isInstanceOf(ResourceNotFoundException.class);
    }
}
