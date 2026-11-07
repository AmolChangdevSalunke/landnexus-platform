package com.landnexus.compensation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.compensation.application.PaymentSplitter.Part;
import com.landnexus.compensation.application.PaymentSplitter.Share;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PaymentSplitterTest {

    private static Share share(String percent) {
        return new Share(UUID.randomUUID(), new BigDecimal(percent));
    }

    private static BigDecimal sum(List<Part> parts) {
        return parts.stream().map(Part::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void sixtyForty_splitsExactly() {
        List<Part> parts = PaymentSplitter.split(new BigDecimal("4700002.00"), List.of(share("60"), share("40")));

        assertThat(parts.get(0).amount()).isEqualByComparingTo("2820001.20");
        assertThat(parts.get(1).amount()).isEqualByComparingTo("1880000.80");
    }

    @Test
    void theLeftoverPaiseGoToTheLargestShare_andThePartsAlwaysAddUp() {
        List<Part> parts = PaymentSplitter.split(new BigDecimal("100.00"), List.of(share("33.33"), share("33.33"), share("33.34")));
        assertThat(sum(parts)).isEqualByComparingTo("100.00");

        List<Part> odd = PaymentSplitter.split(new BigDecimal("0.01"), List.of(share("50"), share("50")));
        assertThat(sum(odd)).isEqualByComparingTo("0.01");
        assertThat(odd.get(0).amount()).isEqualByComparingTo("0.01");
        assertThat(odd.get(1).amount()).isEqualByComparingTo("0.00");

        List<Part> awkward = PaymentSplitter.split(new BigDecimal("1000003.07"),
                List.of(share("12.5"), share("37.5"), share("20"), share("30")));
        assertThat(sum(awkward)).isEqualByComparingTo("1000003.07");
    }

    @Test
    void sharesThatDoNotTotalOneHundred_orNoOwners_areRefused() {
        assertThatThrownBy(() -> PaymentSplitter.split(BigDecimal.TEN, List.of(share("60"), share("30"))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not 100%");
        assertThatThrownBy(() -> PaymentSplitter.split(BigDecimal.TEN, List.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aSingleOwnerGetsEverything() {
        assertThat(PaymentSplitter.split(new BigDecimal("12345.67"), List.of(share("100"))).get(0).amount())
                .isEqualByComparingTo("12345.67");
    }
}