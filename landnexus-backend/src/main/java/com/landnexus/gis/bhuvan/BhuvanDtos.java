package com.landnexus.gis.bhuvan;

import tools.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Small summaries for the Bhuvan endpoints. The provider token is never part of any of these records. */
public final class BhuvanDtos {

    private BhuvanDtos() {
    }

    public record Status(boolean enabled, boolean tokenConfigured, boolean lulcAvailable, boolean villageGeocodingAvailable,
                         boolean maharashtraVillageVerified, List<String> documentedVillageStates, String provider,
                         String message) {
    }

    /** Either a LandNexus project (its corridor becomes the AOI) or an explicit WKT Polygon may be supplied. */
    public record LulcAoiRequest(UUID projectId, String wkt) {
    }

    public record LulcRecord(String year, String description, BigDecimal areaSqKm, Map<String, Object> raw) {
    }

    public record LulcClass(String description, BigDecimal areaSqKm, int records) {
    }

    public record LulcAnalysis(UUID runId, UUID projectId, String projectCode, String stateCode, String stateName,
                               String districtName, String aoiSource, BigDecimal aoiAreaHa, String status, String message,
                               Instant fetchedAt, List<LulcRecord> records, List<LulcClass> totals, List<String> years,
                               JsonNode raw) {
    }

    public record HistoryItem(UUID runId, UUID projectId, String projectCode, String stateCode, String stateName,
                              String districtName, String aoiSource, BigDecimal aoiAreaHa, String status, String message,
                              int recordCount, BigDecimal totalAreaSqKm, String requestedByUsername, Instant createdAt,
                              boolean resultAvailable) {
    }

    public record HistoryPage(List<HistoryItem> content, int page, int size, long totalElements, int totalPages) {
    }

    public record VillageResult(String query, String endpoint, String stateCode, boolean maharashtraVerified,
                                String coverageNote, int recordCount, List<Map<String, Object>> records) {
    }

    public record ErrorBody(int status, String connectionState, Integer providerStatus, String message,
                            Map<String, Object> details) {
    }
}

