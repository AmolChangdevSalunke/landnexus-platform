// PaymentEventRepository.java
package com.landnexus.compensation.infrastructure;

import com.landnexus.compensation.domain.PaymentEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentEventRepository extends JpaRepository<PaymentEvent, UUID> {
    List<PaymentEvent> findByPaymentIdOrderByOccurredAtAsc(UUID paymentId);
}