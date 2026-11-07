package com.landnexus.compensation.infrastructure;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The application refuses to start with any payment mode other than SIMULATED until a real adapter exists. */
@Component
public class PaymentModeGuard {

    public PaymentModeGuard(@Value("${landnexus.payments.mode:SIMULATED}") String mode) {
        check(mode);
    }

    static void check(String mode) {
        if (!SimulatedPfmsAdapter.MODE.equals(mode)) {
            throw new IllegalStateException("landnexus.payments.mode=" + mode + " is not supported: only SIMULATED payments exist");
        }
    }
}