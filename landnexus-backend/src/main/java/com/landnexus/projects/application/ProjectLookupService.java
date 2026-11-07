package com.landnexus.projects.application;

import com.landnexus.projects.domain.ProjectStatus;
import com.landnexus.projects.infrastructure.ProjectRepository;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The published, read-only API other modules use to ask about projects. */
@Service
@Transactional(readOnly = true)
public class ProjectLookupService {

    public record ProjectRef(UUID id, String code, String title, UUID stateId, UUID districtId, Set<UUID> villageIds) {
    }

    private final ProjectRepository projects;

    public ProjectLookupService(ProjectRepository projects) {
        this.projects = projects;
    }

    public Optional<ProjectRef> findActiveProject(UUID id) {
        return projects.findById(id)
                .filter(p -> p.getStatus() == ProjectStatus.ACTIVE)
                .map(p -> new ProjectRef(p.getId(), p.getCode(), p.getTitle(), p.getStateId(), p.getDistrictId(),
                        Set.copyOf(p.getVillageIds())));
    }
}