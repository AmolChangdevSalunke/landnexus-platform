// ValuationLineRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.ValuationLine;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ValuationLineRepository extends JpaRepository<ValuationLine, UUID> {

    List<ValuationLine> findByValuationIdOrderByPositionAsc(UUID valuationId);
}