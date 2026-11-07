// AssetRecordRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.AssetRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetRecordRepository extends JpaRepository<AssetRecord, UUID> {

    List<AssetRecord> findByCaseParcelIdOrderByCreatedAtAsc(UUID caseParcelId);

    List<AssetRecord> findByCaseParcelIdAndVoidedFalse(UUID caseParcelId);
}