package com.landnexus.compensation.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Divides an amount among owners by share so that the parts add up to the total exactly, to the paisa. */
public final class PaymentSplitter {

    public record Share(UUID landownerId, BigDecimal percent) {
    }

    public record Part(UUID landownerId, BigDecimal percent, BigDecimal amount) {
    }

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private PaymentSplitter() {
    }

    /** Each part is rounded DOWN; the leftover paise go to the owner with the largest share (the first one on a tie). */
    public static List<Part> split(BigDecimal total, List<Share> shares) {
        if (shares.isEmpty()) {
            throw new IllegalArgumentException("There are no owners to pay");
        }
        BigDecimal percentSum = shares.stream().map(Share::percent).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (percentSum.compareTo(HUNDRED) != 0) {
            throw new IllegalArgumentException("The ownership shares total " + percentSum.stripTrailingZeros().toPlainString() + "%, not 100%");
        }
        BigDecimal[] amounts = new BigDecimal[shares.size()];
        BigDecimal given = BigDecimal.ZERO;
        int largest = 0;
        for (int i = 0; i < shares.size(); i++) {
            amounts[i] = total.multiply(shares.get(i).percent()).divide(HUNDRED, 2, RoundingMode.DOWN);
            given = given.add(amounts[i]);
            if (shares.get(i).percent().compareTo(shares.get(largest).percent()) > 0) {
                largest = i;
            }
        }
        amounts[largest] = amounts[largest].add(total.subtract(given));
        List<Part> parts = new ArrayList<>();
        for (int i = 0; i < shares.size(); i++) {
            parts.add(new Part(shares.get(i).landownerId(), shares.get(i).percent(), amounts[i]));
        }
        return parts;
    }
}