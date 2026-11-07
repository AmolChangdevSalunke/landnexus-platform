// AcquisitionAwardRepository.java
package com.landnexus.acquisition.infrastructure;

import com.landnexus.acquisition.domain.AcquisitionAward;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AcquisitionAwardRepository extends JpaRepository<AcquisitionAward, UUID> {
    Optional<AcquisitionAward> findByCaseId(UUID caseId);
    boolean existsByCaseId(UUID caseId);
}