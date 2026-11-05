package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.Project;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface ProjectRepository extends JpaRepository<Project, UUID>, JpaSpecificationExecutor<Project> {

    Optional<Project> findByProposalId(UUID proposalId);

    @Query(value = "select nextval('project_number_seq')", nativeQuery = true)
    Long nextNumber();
}
