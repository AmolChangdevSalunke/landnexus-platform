package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.ProposalAssignment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProposalAssignmentRepository extends JpaRepository<ProposalAssignment, UUID> {

    List<ProposalAssignment> findByProposalIdOrderByAssignedAtAsc(UUID proposalId);

    Optional<ProposalAssignment> findFirstByProposalIdAndStageAndStatusInOrderByAssignedAtDesc(
            UUID proposalId, String stage, Collection<String> statuses);

    List<ProposalAssignment> findByAssignedUserIdAndStatusInOrderByAssignedAtAsc(
            UUID assignedUserId, Collection<String> statuses);

    Page<ProposalAssignment> findByAssignedUserIdAndStatusIn(
            UUID assignedUserId, Collection<String> statuses, Pageable pageable);

    /** Open assignments per user, used to pick the least-loaded candidate. */
    @Query("select a.assignedUserId, count(a) from ProposalAssignment a "
            + "where a.status in ('PENDING', 'IN_PROGRESS') group by a.assignedUserId")
    List<Object[]> openAssignmentCounts();
}
