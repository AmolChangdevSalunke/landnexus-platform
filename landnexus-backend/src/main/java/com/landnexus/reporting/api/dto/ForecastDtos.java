package com.landnexus.reporting.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A statistical forecast from this system's own history. It is NOT machine learning and says so. Counts and hours only: no personal data. */
public final class ForecastDtos {

    private ForecastDtos() {
    }

    public record StageStat(String itemType, String title, int samples, Double medianHours, Double p90Hours, int warnAfterHours,
                            int breachAfterHours, long open, long atRisk) {
    }

    /** risk: HIGH, MEDIUM (listed), or LOW and INSUFFICIENT_DATA (counted only). breachProbability is null when it cannot be estimated. */
    public record ForecastItem(String itemType, String title, UUID entityId, String reference, UUID districtId, Instant since,
                               double ageHours, String risk, Double breachProbability, Double expectedRemainingHours, int samples,
                               int comparable, String explanation, String responsibleRole) {
    }

    public record ForecastOverview(Instant generatedAt, String method, String methodNote, List<StageStat> stages,
                                   List<ForecastItem> items, boolean itemsTruncated, List<String> notes) {
    }
}