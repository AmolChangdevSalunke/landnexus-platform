// RrEntitlementRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.CompTypes.EntitlementStatus;
import com.landnexus.compensation.domain.RrEntitlement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RrEntitlementRepository extends JpaRepository<RrEntitlement, UUID> {
    List<RrEntitlement> findByRrCaseIdOrderByCreatedAtAsc(UUID rrCaseId);
    boolean existsByRrCaseIdAndBenefitTypeId(UUID rrCaseId, UUID benefitTypeId);
    long countByRrCaseIdAndStatus(UUID rrCaseId, EntitlementStatus status);
}