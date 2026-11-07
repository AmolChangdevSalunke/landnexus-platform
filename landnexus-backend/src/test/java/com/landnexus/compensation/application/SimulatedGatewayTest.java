package com.landnexus.compensation.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.landnexus.compensation.infrastructure.PaymentGateway.Instruction;
import com.landnexus.compensation.infrastructure.PaymentGateway.Receipt;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SimulatedGatewayTest {

    @Test
    void theSimulatedAdapterNeverClaimsToBeReal() {
        Receipt r = new SimulatedPfmsAdapter().submit(new Instruction(UUID.randomUUID(), UUID.randomUUID(), BigDecimal.TEN));

        assertThat(r.mode()).isEqualTo("SIMULATED");
        assertThat(r.reference()).startsWith("SIM-PFMS-");
    }

    @Test
    void anyOtherPaymentMode_stopsTheApplication() {
        PaymentModeGuard.check("SIMULATED");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> PaymentModeGuard.check("LIVE"))
                .isInstanceOf(IllegalStateException.class);
    }
}