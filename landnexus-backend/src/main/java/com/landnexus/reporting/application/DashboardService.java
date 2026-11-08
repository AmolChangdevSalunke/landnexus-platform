package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.MonitoringDtos.AcquisitionStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.Dashboard;
import com.landnexus.reporting.api.dto.MonitoringDtos.FinanceStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.LandStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.ProjectStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.ProposalStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.StatusAmount;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DashboardRepository.AcqParcelTotals;
import com.landnexus.reporting.infrastructure.DashboardRepository.LandTotals;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One dashboard for every level: the same numbers, limited to the caller's scope and to the optional state or district.
 * Money appears only with the matching permission. Counts only: no personal data.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final DashboardRepository repo;
    private final ReportingScope scopes;
    private final Clock clock;

    public DashboardService(DashboardRepository repo, ReportingScope scopes, Clock clock) {
        this.repo = repo;
        this.scopes = scopes;
        this.clock = clock;
    }

    public Dashboard dashboard(UUID stateId, UUID districtId, CurrentActor actor) {
        DistrictScope scope = scopes.resolve(actor, stateId, districtId);
        String level = districtId != null ? "DISTRICT" : stateId != null ? "STATE" : scope.unrestricted() ? "NATIONAL" : "SCOPED";

        Map<String, Long> proposals = repo.proposalsByStatus(scope);
        Map<String, Long> projects = repo.projectsByStatus(scope);
        LandTotals land = repo.landTotals(scope);
        Map<String, Long> cases = repo.casesByStatus(scope);
        AcqParcelTotals acquisitionParcels = repo.acquisitionParcels(scope);

        FinanceStats finance = null;
        if (actor.hasAuthority("VALUATION_READ")) {
            List<StatusAmount> payments = actor.hasAuthority("PAYMENT_READ") ? repo.paymentsByStatus(scope) : null;
            Map<String, Long> rr = actor.hasAuthority("RR_READ") ? repo.rrCasesByStatus(scope) : null;
            finance = new FinanceStats(repo.estimatesByStatus(scope), payments, rr, payments == null ? null : "SIMULATED");
        }

        List<String> notes = new ArrayList<>();
        notes.add("Counts include only records inside your geographic scope.");
        notes.add("Months are counted in Asia/Kolkata time.");
        if (finance == null) {
            notes.add("Compensation figures are hidden: they need the valuation permission.");
        } else if (finance.payments() != null) {
            notes.add("All payment figures are SIMULATED: no real money has moved.");
        }

        return new Dashboard(clock.instant(), level, stateId, districtId,
                new ProposalStats(proposals, sum(proposals), get(proposals, "SUBMITTED") + get(proposals, "UNDER_SCRUTINY"),
                        get(proposals, "RECOMMENDED"), get(proposals, "APPROVED"), get(proposals, "REJECTED")),
                new ProjectStats(projects, sum(projects), repo.projectsAreaHa(scope)),
                new LandStats(land.activeParcels(), land.areaHa(), land.withBoundary(), percent(land.withBoundary(), land.activeParcels()),
                        repo.documentsPendingVerification(scope)),
                new AcquisitionStats(cases, sum(cases), sum(cases) - get(cases, "CLOSED") - get(cases, "CANCELLED"),
                        acquisitionParcels.parcels(), acquisitionParcels.areaToAcquireHa(), repo.surveysByStatus(scope),
                        repo.objectionsByStatus(scope), repo.awardsDeclared(scope), repo.possessionsRecorded(scope)),
                finance, repo.trend(scope), repo.districtRows(scope), List.copyOf(notes));
    }

    private static long get(Map<String, Long> map, String key) {
        return map.getOrDefault(key, 0L);
    }

    private static long sum(Map<String, Long> map) {
        return map.values().stream().mapToLong(Long::longValue).sum();
    }

    static BigDecimal percent(long part, long whole) {
        if (whole == 0) {
            return BigDecimal.ZERO.setScale(1);
        }
        return BigDecimal.valueOf(part).multiply(new BigDecimal("100")).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }
}