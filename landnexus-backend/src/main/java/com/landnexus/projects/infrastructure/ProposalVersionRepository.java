package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.ProposalVersion;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalVersionRepository extends JpaRepository<ProposalVersion, UUID> {

    List<ProposalVersion> findByProposalIdOrderByVersionNoAsc(UUID proposalId);
}
