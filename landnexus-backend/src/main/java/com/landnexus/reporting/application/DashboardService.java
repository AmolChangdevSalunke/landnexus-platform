package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.MonitoringDtos.AcquisitionStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.Dashboard;
import com.landnexus.reporting.api.dto.MonitoringDtos.FinanceStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.LandStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.OperationalStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.ProjectStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.ProposalStats;
import com.landnexus.reporting.api.dto.MonitoringDtos.StatusAmount;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DashboardRepository.AcqParcelTotals;
import com.landnexus.reporting.infrastructure.DashboardRepository.LandTotals;
import com.landnexus.reporting.infrastructure.DashboardFilter;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.LocalDate;
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
        return dashboard(stateId, districtId, null, null, null, null, actor);
    }

    public Dashboard dashboard(UUID stateId, UUID districtId, UUID projectId, UUID talukaId,
                               LocalDate fromDate, LocalDate toDate, CurrentActor actor) {
        return dashboard(stateId, districtId, projectId, talukaId, fromDate, toDate, null, null, null, actor);
    }

    public Dashboard dashboard(UUID stateId, UUID districtId, UUID projectId, UUID talukaId,
                               LocalDate fromDate, LocalDate toDate, String proposalStatus, String projectStatus,
                               String acquisitionStatus, CurrentActor actor) {
        DashboardFilter filter = scopes.resolveDashboard(actor, stateId, districtId, projectId, talukaId, fromDate, toDate,
                proposalStatus, projectStatus, acquisitionStatus);
        DistrictScope scope = filter.districts();
        String level = districtId != null ? "DISTRICT" : stateId != null ? "STATE" : scope.unrestricted() ? "NATIONAL" : "SCOPED";

        Map<String, Long> proposals = repo.proposalsByStatus(filter);
        Map<String, Long> projects = repo.projectsByStatus(filter);
        LandTotals land = repo.landTotals(filter);
        Map<String, Long> cases = repo.casesByStatus(filter);
        AcqParcelTotals acquisitionParcels = repo.acquisitionParcels(filter);

        FinanceStats finance = null;
        if (actor.hasAuthority("VALUATION_READ")) {
            List<StatusAmount> payments = actor.hasAuthority("PAYMENT_READ") ? repo.paymentsByStatus(filter) : null;
            Map<String, Long> rr = actor.hasAuthority("RR_READ") ? repo.rrCasesByStatus(filter) : null;
            Map<String, List<StatusAmount>> rails = actor.hasAuthority("PAYMENT_READ")
                    ? repo.paymentsByChannel(filter) : null;
            finance = new FinanceStats(repo.estimatesByStatus(filter), payments, rr,
                    rails == null ? null : rails.get("PFMS_SIMULATED"),
                    rails == null ? null : rails.get("DBT_SIMULATED"),
                    payments == null ? null : "SIMULATED", rails);
        }

        List<String> notes = new ArrayList<>();
        notes.add("Counts include only records inside your geographic scope.");
        notes.add("Months are counted in Asia/Kolkata time.");
        if (projectId != null || talukaId != null || fromDate != null || toDate != null) {
            notes.add("Dashboard measures use the selected project, taluka and inclusive Asia/Kolkata date filters.");
            notes.add("District comparisons and trends honor the selected project, taluka, date and status filters.");
        }
        if (finance == null) {
            notes.add("Compensation figures are hidden: they need the valuation permission.");
        } else if (finance.payments() != null) {
            notes.add("All payment figures are SIMULATED: no real money has moved.");
            notes.add("PFMS, DBT and other channel values are explicitly classified simulated records; no external payment service is connected.");
        }

        return new Dashboard(clock.instant(), level, stateId, districtId,
                new ProposalStats(proposals, sum(proposals), get(proposals, "SUBMITTED") + get(proposals, "UNDER_SCRUTINY"),
                        get(proposals, "RECOMMENDED"), get(proposals, "APPROVED"), get(proposals, "REJECTED")),
                new ProjectStats(projects, sum(projects), repo.projectsAreaHa(filter)),
                new LandStats(land.activeParcels(), land.areaHa(), land.withBoundary(), percent(land.withBoundary(), land.activeParcels()),
                        repo.documentsPendingVerification(filter)),
                new AcquisitionStats(cases, sum(cases), sum(cases) - get(cases, "CLOSED") - get(cases, "CANCELLED"),
                        acquisitionParcels.parcels(), acquisitionParcels.areaToAcquireHa(), repo.surveysByStatus(filter),
                        repo.objectionsByStatus(filter), repo.awardsDeclared(filter), repo.possessionsRecorded(filter)),
                finance, new OperationalStats(repo.gisConflicts(filter), repo.pendingTasks(filter),
                        repo.escalationsByLevel(filter), actor.hasAuthority("USER_READ") ? repo.officerWorkload(filter) : null),
                repo.trend(filter), repo.districtRows(filter), List.copyOf(notes));
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