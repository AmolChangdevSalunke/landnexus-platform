package com.landnexus.compensation.application;

import com.landnexus.compensation.domain.CompTypes.ComponentType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Deterministic: the same inputs and the same components always give the same lines and total. Money uses
 * BigDecimal, every line is rounded once to 2 decimals (HALF_UP), and the total is the sum of the rounded lines.
 * The engine knows no law: every number comes from the approved rule set.
 */
public final class CompensationEngine {

    public record Component(int position, String code, String name, ComponentType type, BigDecimal factor,
                            List<String> baseCodes) {
    }

    public record Line(int position, String code, String name, ComponentType type, String basis, BigDecimal amount) {
    }

    public record Result(List<Line> lines, BigDecimal total) {
    }

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal LIMIT = new BigDecimal("9999999999999.99");

    private CompensationEngine() {
    }

    public static Result compute(BigDecimal areaHa, BigDecimal ratePerHa, BigDecimal assetTotal, List<Component> components) {
        Map<String, BigDecimal> done = new HashMap<>();
        List<Line> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Component c : components.stream().sorted(Comparator.comparingInt(Component::position)).toList()) {
            BigDecimal amount;
            String basis;
            if (c.type() == ComponentType.LAND_VALUE) {
                amount = areaHa.multiply(ratePerHa).multiply(c.factor());
                basis = plain(areaHa) + " ha x " + plain(ratePerHa) + " x " + plain(c.factor());
            } else if (c.type() == ComponentType.ASSET_VALUE) {
                amount = assetTotal;
                basis = "sum of the recorded assets";
            } else if (c.type() == ComponentType.PERCENT_OF) {
                BigDecimal base = BigDecimal.ZERO;
                for (String code : c.baseCodes()) {
                    BigDecimal value = done.get(code);
                    if (value == null) {
                        throw new IllegalArgumentException("Component " + c.code() + " refers to an unknown or later component: " + code);
                    }
                    base = base.add(value);
                }
                amount = base.multiply(c.factor()).divide(HUNDRED);
                basis = plain(c.factor()) + "% of " + String.join(" + ", c.baseCodes()) + " (" + plain(base) + ")";
            } else {
                amount = areaHa.multiply(c.factor());
                basis = plain(areaHa) + " ha x " + plain(c.factor()) + " per hectare";
            }
            amount = amount.setScale(2, RoundingMode.HALF_UP);
            if (amount.abs().compareTo(LIMIT) > 0) {
                throw new ArithmeticException("The amount of component " + c.code() + " is too large");
            }
            done.put(c.code(), amount);
            lines.add(new Line(c.position(), c.code(), c.name(), c.type(), basis, amount));
            total = total.add(amount);
        }
        if (total.abs().compareTo(LIMIT) > 0) {
            throw new ArithmeticException("The total amount is too large");
        }
        return new Result(List.copyOf(lines), total);
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}