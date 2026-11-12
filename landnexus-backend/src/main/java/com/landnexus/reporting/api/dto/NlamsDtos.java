package com.landnexus.reporting.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * NLAMS progress read-model. Counts, areas and money only: no landowner names, no bank details.
 * Every payment figure is SIMULATED (the platform never talks to PFMS/DBT).
 */
public final class NlamsDtos {

    private NlamsDtos() {
    }

    /**
     * One project with its acquisition counters and a transparent five-milestone progress percent:
     * case started, parcels identified, notification complete, award declared, possession complete.
     */
    public record NlamsProject(UUID projectId, String projectCode, String title, String projectType, String projectStatus,
                               UUID districtId, String districtName, BigDecimal estimatedLandAreaHa,
                               BigDecimal alignmentLengthKm,
                               long cases, long openCases, long casesAwaitingNotification, long casesNotified,
                               long casesAwaitingAward, long casesPossessionComplete,
                               long parcelsIdentified, BigDecimal identifiedHa, long parcelsNotified, BigDecimal notifiedHa,
                               long awards, long parcelsAwarded, BigDecimal awardedHa,
                               long parcelsPossessed, BigDecimal possessionHa, long possessionPhysical,
                               long possessionDeemed, long notices, long objections, long objectionsOpen,
                               BigDecimal assessedTotal, BigDecimal awaitingApprovalTotal, BigDecimal paidTotal,
                               BigDecimal sentTotal, BigDecimal failedTotal, BigDecimal instructedTotal,
                               long affectedFamilies, long displacedFamilies, long livelihoodLostFamilies,
                               long rrCases, long rrCompleted, long rrEntitlements, long rrDelivered,
                               int progressPercent, String currentStage) {
    }

    public record NlamsTotals(long projects, long projectsInAcquisition, long totalCases, long openCases,
                              long parcelsIdentified, BigDecimal identifiedHa, long parcelsNotified, BigDecimal notifiedHa,
                              long parcelsAwarded, BigDecimal awardedHa, long parcelsPossessed, BigDecimal possessionHa,
                              BigDecimal assessedTotal, BigDecimal paidTotal, BigDecimal sentTotal, BigDecimal failedTotal,
                              long affectedFamilies, long displacedFamilies, long rrEntitlements, long rrDelivered) {
    }

    /** projectsByStage is ordered by the workflow stage. paymentMode is always SIMULATED. */
    public record NlamsDashboard(Instant generatedAt, UUID stateId, UUID districtId, String paymentMode,
                                 NlamsTotals totals, Map<String, Long> projectsByStage,
                                 List<NlamsProject> projects) {
    }
}
