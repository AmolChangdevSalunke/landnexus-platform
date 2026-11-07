// RrBenefitTypeRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.RrBenefitType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RrBenefitTypeRepository extends JpaRepository<RrBenefitType, UUID> {
    boolean existsByCode(String code);
    List<RrBenefitType> findAllByOrderByCodeAsc();
}