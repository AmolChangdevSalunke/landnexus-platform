package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.Proposal;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProposalRepository extends JpaRepository<Proposal, UUID>, JpaSpecificationExecutor<Proposal> {

    /** Next value of the database sequence behind proposal numbers (gaps are possible, duplicates are not). */
    @Query(value = "select nextval('proposal_number_seq')", nativeQuery = true)
    Long nextNumber();

    /** Row lock for the approval decision so two concurrent approvals cannot race. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Proposal p where p.id = :id")
    Optional<Proposal> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Fresh read in a new transaction context (caller responsibility) after a rolled-back attempt,
     * used for idempotent recovery without querying inside an aborted PostgreSQL transaction.
     */
    @Query("select p from Proposal p where p.id = :id")
    Optional<Proposal> findCurrentById(@Param("id") UUID id);
}
