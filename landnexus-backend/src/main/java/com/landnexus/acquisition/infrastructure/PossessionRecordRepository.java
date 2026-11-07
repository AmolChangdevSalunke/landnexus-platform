// PossessionRecordRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.PossessionRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PossessionRecordRepository extends JpaRepository<PossessionRecord, UUID> {
    List<PossessionRecord> findByCaseIdOrderByPossessionDateAsc(UUID caseId);
    long countByCaseId(UUID caseId);
    boolean existsByCaseParcelId(UUID caseParcelId);
}