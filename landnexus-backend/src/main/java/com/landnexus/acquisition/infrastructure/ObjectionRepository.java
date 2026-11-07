// ObjectionRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AcquisitionTypes.ObjectionStatus;
import com.landnexus.acquisition.domain.Objection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ObjectionRepository extends JpaRepository<Objection, UUID> {
    List<Objection> findByCaseIdOrderByObjectionNumberAsc(UUID caseId);
    long countByCaseId(UUID caseId);
    long countByCaseIdAndStatus(UUID caseId, ObjectionStatus status);
}