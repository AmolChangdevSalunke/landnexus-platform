package com.landnexus.reporting.application;

import com.landnexus.reporting.api.dto.NlamsDtos.NlamsDashboard;
import com.landnexus.reporting.api.dto.NlamsDtos.NlamsProject;
import com.landnexus.reporting.api.dto.NlamsDtos.NlamsTotals;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.reporting.infrastructure.NlamsRepository;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Real-time NLAMS progress for the monitoring dashboard. Progress is derived from stored counters with a fixed,
 * explainable formula (five equal milestones); nothing is estimated from dates. Payments are always SIMULATED.
 */
@Service
@Transactional(readOnly = true)
public class NlamsMonitoringService {

    public static final String PAYMENT_MODE = "SIMULATED";

    private final NlamsRepository repo;
    private final ReportingScope scope;
    private final Clock clock;

    public NlamsMonitoringService(NlamsRepository repo, ReportingScope scope, Clock clock) {
        this.repo = repo;
        this.scope = scope;
        this.clock = clock;
    }

    public NlamsDashboard dashboard(UUID stateId, UUID districtId, CurrentActor actor) {
        DistrictScope districtScope = scope.resolve(actor, stateId, districtId);
        List<NlamsProject> projects = repo.findProjects(districtScope, stateId).stream()
                .map(NlamsMonitoringService::withProgress)
                .toList();
        return new NlamsDashboard(clock.instant(), stateId, districtId, PAYMENT_MODE, totals(projects),
                byStage(projects), projects);
    }

    /** Five milestones, twenty percent each: case, parcels, notification, award, possession. */
    public static int progressPercent(NlamsProject p) {
        return milestones(p) * 20;
    }

    public static String currentStage(NlamsProject p) {
        boolean caseStarted = p.cases() > 0;
        boolean parcels = p.parcelsIdentified() > 0;
        boolean notified = parcels && p.parcelsNotified() >= p.parcelsIdentified();
        boolean awarded = parcels && p.parcelsAwarded() >= p.parcelsIdentified();
        boolean possession = parcels && p.parcelsPossessed() >= p.parcelsIdentified();
        if (!caseStarted) {
            return "Project approved";
        }
        if (!parcels) {
            return "Case initiated";
        }
        if (!notified) {
            return "Parcels identified";
        }
        if (!awarded) {
            return "Notification complete";
        }
        if (!possession) {
            return "Award declared";
        }
        return "Possession complete";
    }

    private static int milestones(NlamsProject p) {
        boolean caseStarted = p.cases() > 0;
        boolean parcels = p.parcelsIdentified() > 0;
        boolean notified = parcels && p.parcelsNotified() >= p.parcelsIdentified();
        boolean awarded = parcels && p.parcelsAwarded() >= p.parcelsIdentified();
        boolean possession = parcels && p.parcelsPossessed() >= p.parcelsIdentified();
        return (caseStarted ? 1 : 0) + (parcels ? 1 : 0) + (notified ? 1 : 0) + (awarded ? 1 : 0)
                + (possession ? 1 : 0);
    }

    private static NlamsProject withProgress(NlamsProject p) {
        return new NlamsProject(p.projectId(), p.projectCode(), p.title(), p.projectType(), p.projectStatus(),
                p.districtId(), p.districtName(), p.estimatedLandAreaHa(), p.alignmentLengthKm(),
                p.cases(), p.openCases(), p.casesAwaitingNotification(), p.casesNotified(), p.casesAwaitingAward(),
                p.casesPossessionComplete(), p.parcelsIdentified(), p.identifiedHa(), p.parcelsNotified(), p.notifiedHa(),
                p.awards(), p.parcelsAwarded(), p.awardedHa(), p.parcelsPossessed(), p.possessionHa(),
                p.possessionPhysical(), p.possessionDeemed(), p.notices(), p.objections(), p.objectionsOpen(),
                p.assessedTotal(), p.awaitingApprovalTotal(), p.paidTotal(), p.sentTotal(), p.failedTotal(),
                p.instructedTotal(), p.affectedFamilies(), p.displacedFamilies(), p.livelihoodLostFamilies(),
                p.rrCases(), p.rrCompleted(), p.rrEntitlements(), p.rrDelivered(),
                progressPercent(p), currentStage(p));
    }

    private static Map<String, Long> byStage(List<NlamsProject> projects) {
        return projects.stream().collect(Collectors.groupingBy(NlamsProject::currentStage, TreeMap::new,
                Collectors.counting()));
    }

    private static NlamsTotals totals(List<NlamsProject> projects) {
        return new NlamsTotals(
                projects.size(),
                projects.stream().filter(p -> p.cases() > 0).count(),
                sum(projects, NlamsProject::cases),
                sum(projects, NlamsProject::openCases),
                sum(projects, NlamsProject::parcelsIdentified),
                sumAmount(projects, NlamsProject::identifiedHa),
                sum(projects, NlamsProject::parcelsNotified),
                sumAmount(projects, NlamsProject::notifiedHa),
                sum(projects, NlamsProject::parcelsAwarded),
                sumAmount(projects, NlamsProject::awardedHa),
                sum(projects, NlamsProject::parcelsPossessed),
                sumAmount(projects, NlamsProject::possessionHa),
                sumAmount(projects, NlamsProject::assessedTotal),
                sumAmount(projects, NlamsProject::paidTotal),
                sumAmount(projects, NlamsProject::sentTotal),
                sumAmount(projects, NlamsProject::failedTotal),
                sum(projects, NlamsProject::affectedFamilies),
                sum(projects, NlamsProject::displacedFamilies),
                sum(projects, NlamsProject::rrEntitlements),
                sum(projects, NlamsProject::rrDelivered));
    }

    private static long sum(List<NlamsProject> projects, java.util.function.ToLongFunction<NlamsProject> field) {
        return projects.stream().mapToLong(field).sum();
    }

    private static BigDecimal sumAmount(List<NlamsProject> projects,
                                        java.util.function.Function<NlamsProject, BigDecimal> field) {
        return projects.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
