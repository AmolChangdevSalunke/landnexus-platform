package com.landnexus.reporting.application;

import java.util.Locale;

/**
 * The forecast, in plain statistics. Among past items of the same kind that took LONGER than the current item has already
 * waited, what share also took longer than the breach limit? That share is the breach probability. Nothing is learned or
 * fitted: the answer can always be explained with the counts it was computed from.
 */
public final class TimelineForecaster {

    public static final int MIN_SAMPLES = 5;
    public static final int MIN_COMPARABLE = 3;

    public record Result(String level, Double breachProbability, Double expectedRemainingHours, int samples, int comparable, String explanation) {
    }

    private TimelineForecaster() {
    }

    /** sortedAsc = hours taken by completed items of this kind, ascending. */
    public static Result forecast(double ageHours, int breachHours, double[] sortedAsc) {
        int n = sortedAsc.length;
        if (n < MIN_SAMPLES) {
            return new Result("INSUFFICIENT_DATA", null, null, n, 0,
                    "Only " + n + " similar completed item(s) in the history: too few to forecast.");
        }
        int firstLonger = firstGreaterThan(sortedAsc, ageHours);
        int comparable = n - firstLonger;
        if (comparable == 0) {
            return new Result("HIGH", null, null, n, 0, "This item has already waited " + hours(ageHours)
                    + ", longer than all " + n + " similar completed items.");
        }
        if (comparable < MIN_COMPARABLE) {
            return new Result("INSUFFICIENT_DATA", null, null, n, comparable, "Only " + comparable + " of " + n
                    + " similar completed items took longer than the current wait of " + hours(ageHours) + ": too few to forecast.");
        }
        int beyondLimit = n - firstGreaterThan(sortedAsc, breachHours);
        double probability = (double) beyondLimit / comparable;
        double remaining = sortedAsc[firstLonger + (comparable - 1) / 2] - ageHours;
        String level = probability >= 0.5 ? "HIGH" : probability >= 0.2 ? "MEDIUM" : "LOW";
        return new Result(level, round(probability, 2), round(remaining, 1), n, comparable,
                "Of " + comparable + " similar completed items that took longer than " + hours(ageHours) + ", " + beyondLimit
                        + " took longer than the " + breachHours + " h breach limit. Typical remaining wait: about " + hours(remaining) + ".");
    }

    private static int firstGreaterThan(double[] sorted, double value) {
        int low = 0;
        int high = sorted.length;
        while (low < high) {
            int mid = (low + high) >>> 1;
            if (sorted[mid] > value) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }

    static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    private static String hours(double value) {
        return String.format(Locale.ROOT, "%.1f h", value);
    }
}