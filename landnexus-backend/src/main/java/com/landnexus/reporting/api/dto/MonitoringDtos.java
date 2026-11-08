package com.landnexus.reporting.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Everything here is counts, totals and case or project codes: no personal data. */
public final class MonitoringDtos {

    private MonitoringDtos() {
    }

    public record StatusAmount(String status, long count, BigDecimal amount) {
    }

    public record TrendPoint(String month, long proposalsSubmitted, long casesOpened) {
    }

    public record DistrictRow(UUID districtId, String district, String state, long projects, long openCases, long parcels,
                              BigDecimal areaToAcquireHa) {
    }

    public record ProposalStats(Map<String, Long> byStatus, long total, long inReview, long awaitingDecision, long approved,
                                long rejected) {
    }

    public record ProjectStats(Map<String, Long> byStatus, long total, BigDecimal estimatedLandAreaHa) {
    }

    public record LandStats(long activeParcels, BigDecimal totalAreaHa, long parcelsWithBoundary,
                            BigDecimal boundaryCoveragePercent, long documentsPendingVerification) {
    }

    public record AcquisitionStats(Map<String, Long> casesByStatus, long totalCases, long openCases, long parcelsIdentified,
                                   BigDecimal areaToAcquireHa, Map<String, Long> surveysByStatus,
                                   Map<String, Long> objectionsByStatus, long awardsDeclared, long possessionsRecorded) {
    }

    /** payments and rrCasesByStatus are null without PAYMENT_READ or RR_READ; paymentMode is always SIMULATED when present. */
    public record FinanceStats(List<StatusAmount> estimates, List<StatusAmount> payments, Map<String, Long> rrCasesByStatus,
                               String paymentMode) {
    }

    /** level: NATIONAL, STATE, DISTRICT, or SCOPED (a user restricted to some districts). finance is null without VALUATION_READ. */
    public record Dashboard(Instant generatedAt, String level, UUID stateId, UUID districtId, ProposalStats proposals,
                            ProjectStats projects, LandStats land, AcquisitionStats acquisition, FinanceStats finance,
                            List<TrendPoint> trend, List<DistrictRow> districts, List<String> notes) {
    }

    /** type: TEXT, NUMBER, DATE or MONEY (a hint for formatting). */
    public record Column(String key, String label, String type) {
    }

    public record ReportInfo(String code, String title, String description, List<Column> columns) {
    }

    public record ReportResult(String code, String title, List<Column> columns, List<Map<String, Object>> rows, int page,
                               int size, long totalRows) {
    }
}