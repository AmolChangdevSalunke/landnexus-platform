// CompensationPaymentRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.CompensationPayment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompensationPaymentRepository extends JpaRepository<CompensationPayment, UUID> {
    List<CompensationPayment> findByCaseIdOrderByCreatedAtAsc(UUID caseId);
    List<CompensationPayment> findByValuationIdOrderByCreatedAtAsc(UUID valuationId);
    boolean existsByValuationId(UUID valuationId);
}