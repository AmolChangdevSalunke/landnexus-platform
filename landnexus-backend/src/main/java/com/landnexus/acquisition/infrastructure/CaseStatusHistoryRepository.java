// CaseStatusHistoryRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.CaseStatusHistory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseStatusHistoryRepository extends JpaRepository<CaseStatusHistory, UUID> {

    List<CaseStatusHistory> findByCaseIdOrderByOccurredAtAsc(UUID caseId);
}