package com.landnexus.gis.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** The geometry itself travels as GeoJSON (request body and Feature responses); these are the small summaries. */
public final class GisDtos {

    private GisDtos() {
    }

    /** variancePercent compares the drawn area with the area recorded in land records (information only). */
    public record BoundaryResponse(UUID parcelId, int versionNo, BigDecimal areaHa, BigDecimal recordedAreaHa,
                                   BigDecimal variancePercent, int vertices) {
    }

    public record BoundaryVersion(int versionNo, BigDecimal areaHa, int vertices, String sourceNote, String enteredByUsername,
                                  Instant enteredAt, boolean current) {
    }

    public record AlignmentResponse(UUID projectId, int versionNo, BigDecimal lengthKm, int corridorWidthM, int vertices) {
    }

    public record AlignmentVersion(int versionNo, BigDecimal lengthKm, int corridorWidthM, int vertices, String sourceNote,
                                   String enteredByUsername, Instant enteredAt, boolean current) {
    }
}