package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.ProposalStatusHistory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProposalStatusHistoryRepository extends JpaRepository<ProposalStatusHistory, UUID> {

    List<ProposalStatusHistory> findByProposalIdOrderByOccurredAtAsc(UUID proposalId);
}
