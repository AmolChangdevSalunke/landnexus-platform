package com.landnexus.projects.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.landnexus.projects.api.dto.ProjectResponse;
import com.landnexus.projects.domain.Project;
import com.landnexus.projects.infrastructure.ProjectRepository;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock private ProjectRepository projects;
    @Mock private ProposalAccess access;

    private ProjectService service;

    private final CurrentActor actor = new CurrentActor(UUID.randomUUID(), "officer", Set.of("SCRUTINY_OFFICER"), Set.of("PROPOSAL_READ"));

    @BeforeEach
    void setUp() {
        service = new ProjectService(projects, access);
    }

    private Project project(UUID id) {
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", id);
        project.setCode("PRJ-2026-000001");
        project.setDistrictId(UUID.randomUUID());
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
}
