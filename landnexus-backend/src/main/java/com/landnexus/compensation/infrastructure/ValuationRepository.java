// ValuationRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.CompTypes.ValuationStatus;
import com.landnexus.compensation.domain.Valuation;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ValuationRepository extends JpaRepository<Valuation, UUID> {

    List<Valuation> findByCaseIdOrderByCaseParcelIdAscVersionNoDesc(UUID caseId);

    Optional<Valuation> findFirstByCaseParcelIdAndStatusIn(UUID caseParcelId, Collection<ValuationStatus> statuses);

    @Query("select coalesce(max(v.versionNo), 0) from Valuation v where v.caseParcelId = :caseParcelId")
    int maxVersion(@Param("caseParcelId") UUID caseParcelId);
}