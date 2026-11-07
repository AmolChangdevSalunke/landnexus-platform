// RrCaseRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.RrCase;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RrCaseRepository extends JpaRepository<RrCase, UUID> {
    List<RrCase> findByCaseIdOrderByCreatedAtAsc(UUID caseId);
    boolean existsByCaseIdAndLandownerId(UUID caseId, UUID landownerId);
}