package com.landnexus.projects.infrastructure;

import com.landnexus.projects.domain.Proposal;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface ProposalRepository extends JpaRepository<Proposal, UUID>, JpaSpecificationExecutor<Proposal> {

    /** Next value of the database sequence behind proposal numbers (gaps are possible, duplicates are not). */
    @Query(value = "select nextval('proposal_number_seq')", nativeQuery = true)
    Long nextNumber();
}
