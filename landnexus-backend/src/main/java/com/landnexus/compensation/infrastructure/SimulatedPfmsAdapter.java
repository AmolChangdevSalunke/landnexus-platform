package com.landnexus.compensation.infrastructure;

import java.util.Locale;
import org.springframework.stereotype.Component;

/** Pretends to accept a payment. Nothing leaves this system; every reference starts with SIM-PFMS-. */
@Component
public class SimulatedPfmsAdapter implements PaymentGateway {

    public static final String MODE = "SIMULATED";

    @Override
    public Receipt submit(Instruction instruction) {
        String reference = "SIM-PFMS-" + instruction.paymentId().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        return new Receipt(reference, MODE);
    }

    @Override
    public String mode() {
        return MODE;
    }
}