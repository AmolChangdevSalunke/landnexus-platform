package com.landnexus.gis.application;

import com.landnexus.gis.api.dto.ConflictDtos.AffectedParcelDto;
import com.landnexus.gis.api.dto.ConflictDtos.ConflictReport;
import com.landnexus.gis.api.dto.ConflictDtos.Finding;
import com.landnexus.gis.api.dto.ConflictDtos.Severity;
import com.landnexus.gis.infrastructure.GisReportRepository;
import com.landnexus.gis.infrastructure.GisReportRepository.AlignmentMeta;
import com.landnexus.projects.application.ProjectLookupService;
import com.landnexus.projects.application.ProjectLookupService.ProjectRef;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The conflict report and the map of a project. Read-only and computed fresh on every call. */
@Service
@Transactional(readOnly = true)
public class ConflictService {

    static final List<String> LIMITATIONS = List.of(
            "These are indicators from boundaries entered by officers, not legal findings; the competent authority decides what applies.",
            "Parcels without a boundary cannot be checked; the report says how many there are.",
            "The corridor is a simple buffer around the alignment (width / 2 on each side), not an engineered right-of-way.",
            "The project is assumed to lie in one district; parcels of other districts are not included.");

    private final GisReportRepository reports;
    private final ProjectLookupService projects;
    private final GisAccess access;

    public ConflictService(GisReportRepository reports, ProjectLookupService projects, GisAccess access) {
        this.reports = reports;
        this.projects = projects;
        this.access = access;
    }

    public ConflictReport report(UUID projectId, CurrentActor actor) {
        ProjectRef project = visibleProject(projectId, actor);
        AlignmentMeta meta = alignment(projectId);
        ConflictAnalyzer.Result result = ConflictAnalyzer.analyze(projectId,
                reports.affectedParcels(projectId, project.districtId()), reports.caseParcelChecks(projectId),
                reports.overlaps(projectId, project.districtId()), reports.surveyPoints(projectId), reports.coverage(projectId));
        GisReportRepository.Coverage coverage = reports.coverage(projectId);
        BigDecimal total = result.parcels().stream().map(AffectedParcelDto::affectedHa).reduce(BigDecimal.ZERO, BigDecimal::add);
        int warnings = (int) result.findings().stream().filter(f -> f.severity() == Severity.WARNING).count();
        List<Finding> findings = result.findings();
        return new ConflictReport(projectId, project.code(), meta.versionNo(), meta.corridorWidthM(), meta.corridorAreaHa(),
                coverage.total(), coverage.withBoundary(), result.parcels().size(), total, warnings, findings.size() - warnings,
                result.parcels(), findings, LIMITATIONS);
    }

    public String map(UUID projectId, CurrentActor actor) {
        ProjectRef project = visibleProject(projectId, actor);
        alignment(projectId);
        return reports.mapFeatureCollection(projectId, project.districtId());
    }

    private AlignmentMeta alignment(UUID projectId) {
        return reports.alignmentMeta(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("No alignment has been recorded for this project"));
    }

    private ProjectRef visibleProject(UUID projectId, CurrentActor actor) {
        return projects.findActiveProject(projectId).filter(p -> access.canView(actor, p.districtId()))
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
    }
}