// MarketValueRateRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.CompTypes.RateStatus;
import com.landnexus.compensation.domain.MarketValueRate;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MarketValueRateRepository extends JpaRepository<MarketValueRate, UUID>, JpaSpecificationExecutor<MarketValueRate> {

    boolean existsByVillageIdAndClassificationAndEffectiveFromAndStatusNot(UUID villageId, String classification,
                                                                           LocalDate effectiveFrom, RateStatus status);

    Optional<MarketValueRate> findFirstByVillageIdAndClassificationAndStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
            UUID villageId, String classification, RateStatus status, LocalDate onOrBefore);
}