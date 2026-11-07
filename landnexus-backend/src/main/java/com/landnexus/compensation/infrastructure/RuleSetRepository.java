// RuleSetRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.CompTypes.RuleSetStatus;
import com.landnexus.compensation.domain.RuleSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RuleSetRepository extends JpaRepository<RuleSet, UUID> {

    @Query("select coalesce(max(r.version), 0) from RuleSet r where r.name = :name")
    int maxVersion(@Param("name") String name);

    List<RuleSet> findByStatusAndFramework(RuleSetStatus status, String framework);

    Page<RuleSet> findByStatus(RuleSetStatus status, Pageable pageable);
}