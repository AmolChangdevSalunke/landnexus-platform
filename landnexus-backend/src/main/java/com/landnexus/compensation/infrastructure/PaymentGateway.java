package com.landnexus.compensation.infrastructure;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * The seam to a real payment system (PFMS/DBT). Only the SIMULATED adapter exists: a real one needs official access
 * and is therefore blocked outside this project. The instruction carries NO bank details and no personal data.
 */
public interface PaymentGateway {

    record Instruction(UUID paymentId, UUID landownerId, BigDecimal amount) {
    }

    record Receipt(String reference, String mode) {
    }

    Receipt submit(Instruction instruction);

    String mode();
}