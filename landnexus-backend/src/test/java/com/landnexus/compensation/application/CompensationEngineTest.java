package com.landnexus.compensation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.landnexus.compensation.application.CompensationEngine.Component;
import com.landnexus.compensation.application.CompensationEngine.Result;
import com.landnexus.compensation.domain.CompTypes.ComponentType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CompensationEngineTest {

    private static Component land(String multiplier) {
        return new Component(1, "LAND", "Land", ComponentType.LAND_VALUE, new BigDecimal(multiplier), List.of());
    }

    private static Component assets() {
        return new Component(2, "ASSETS", "Assets", ComponentType.ASSET_VALUE, BigDecimal.ONE, List.of());
    }

    private static Component solatium(String percent) {
        return new Component(3, "SOLATIUM", "Solatium", ComponentType.PERCENT_OF, new BigDecimal(percent), List.of("LAND", "ASSETS"));
    }

    @Test
    void landAssetsAndAPercentageOfBoth() {
        Result r = CompensationEngine.compute(new BigDecimal("1.5"), new BigDecimal("1000000"), new BigDecimal("100001.00"),
                List.of(land("1.5"), assets(), solatium("100")));

        assertThat(r.lines()).hasSize(3);
        assertThat(r.lines().get(0).amount()).isEqualByComparingTo("2250000.00");
        assertThat(r.lines().get(1).amount()).isEqualByComparingTo("100001.00");
        assertThat(r.lines().get(2).amount()).isEqualByComparingTo("2350001.00");
        assertThat(r.total()).isEqualByComparingTo("4700002.00");
        assertThat(r.lines().get(0).basis()).contains("1.5 ha").contains("1000000");
    }

    @Test
    void everyLineIsRoundedOnce_halfUp_andTheTotalIsTheSumOfRoundedLines() {
        Result r = CompensationEngine.compute(new BigDecimal("0.3333"), new BigDecimal("100.05"), BigDecimal.ZERO,
                List.of(land("1"), new Component(2, "PCT", "Pct", ComponentType.PERCENT_OF, new BigDecimal("33.333333"), List.of("LAND"))));

        assertThat(r.lines().get(0).amount()).isEqualByComparingTo("33.35");
        assertThat(r.lines().get(1).amount()).isEqualByComparingTo("11.12");
        assertThat(r.total()).isEqualByComparingTo("44.47");
    }

    @Test
    void sameInputsAlwaysGiveTheSameResult() {
        List<Component> rules = List.of(land("1.25"), assets(), solatium("30"));
        Result a = CompensationEngine.compute(new BigDecimal("2.7182"), new BigDecimal("123456.78"), new BigDecimal("999.99"), rules);
        Result b = CompensationEngine.compute(new BigDecimal("2.7182"), new BigDecimal("123456.78"), new BigDecimal("999.99"), rules);

        assertThat(a.total()).isEqualByComparingTo(b.total());
        assertThat(a.lines()).isEqualTo(b.lines());
    }

    @Test
    void fixedAmountPerHectare() {
        Result r = CompensationEngine.compute(new BigDecimal("2.5"), new BigDecimal("1000"), BigDecimal.ZERO,
                List.of(land("1"), new Component(2, "FIX", "Fixed", ComponentType.FIXED_PER_HECTARE, new BigDecimal("40000"), List.of())));

        assertThat(r.lines().get(1).amount()).isEqualByComparingTo("100000.00");
        assertThat(r.total()).isEqualByComparingTo("102500.00");
    }

    @Test
    void aPercentageOfAnUnknownOrLaterComponent_isRefused() {
        List<Component> rules = List.of(land("1"), new Component(2, "BAD", "Bad", ComponentType.PERCENT_OF, BigDecimal.TEN, List.of("NOPE")));

        assertThatThrownBy(() -> CompensationEngine.compute(BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, rules))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void absurdlyLargeAmounts_areRefused() {
        assertThatThrownBy(() -> CompensationEngine.compute(new BigDecimal("99999999"), new BigDecimal("9999999999999.99"),
                BigDecimal.ZERO, List.of(land("10"))))
                .isInstanceOf(ArithmeticException.class);
    }

    @Test
    void componentsRunInPositionOrder_whateverTheListOrder() {
        Result r = CompensationEngine.compute(BigDecimal.ONE, new BigDecimal("100"), BigDecimal.ZERO,
                List.of(solatium("10"), land("1"), assets()));

        assertThat(r.lines().get(0).code()).isEqualTo("LAND");
        assertThat(r.lines().get(2).amount()).isEqualByComparingTo("10.00");
    }
}