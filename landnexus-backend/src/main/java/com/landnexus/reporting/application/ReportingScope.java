package com.landnexus.reporting.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DashboardFilter;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import com.landnexus.projects.domain.ProposalStatus;
import com.landnexus.projects.domain.ProjectStatus;
import com.landnexus.acquisition.domain.AcquisitionTypes.CaseStatus;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.security.access.AccessDeniedException;

/**
 * Turns "who is asking" and an optional state or district filter into the districts a report may include.
 * A filter outside the caller's scope is reported as "not found". A districtId wins over a stateId.
 */
@Component
public class ReportingScope {

    private final GeoScopeService geoScope;
    private final DashboardRepository repo;

    public ReportingScope(GeoScopeService geoScope, DashboardRepository repo) {
        this.geoScope = geoScope;
        this.repo = repo;
    }

    public DistrictScope resolve(CurrentActor actor, UUID stateId, UUID districtId) {
        Optional<Set<UUID>> allowed = geoScope.accessibleDistrictIds(actor);
        if (districtId != null) {
            if (!geoScope.canAccessDistrict(actor, districtId)) {
                throw new ResourceNotFoundException("District not found: " + districtId);
            }
            return new DistrictScope(false, Set.of(districtId));
        }
        if (stateId != null) {
            Set<UUID> inState = repo.districtIdsOfState(stateId);
            Set<UUID> visible = allowed.map(a -> inState.stream().filter(a::contains).collect(Collectors.toSet())).orElse(inState);
            if (visible.isEmpty()) {
                throw new ResourceNotFoundException("State not found: " + stateId);
            }
            return new DistrictScope(false, visible);
        }
        return allowed.map(a -> new DistrictScope(false, Set.copyOf(a))).orElseGet(DistrictScope::all);
    }

    public DashboardFilter resolveDashboard(CurrentActor actor, UUID stateId, UUID districtId, UUID projectId,
                                             UUID talukaId, LocalDate fromDate, LocalDate toDate,
                                             String proposalStatus, String projectStatus, String acquisitionStatus) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new InvalidRequestException("fromDate must be on or before toDate");
        }
        DistrictScope districtScope = resolve(actor, stateId, districtId);
        if (projectId != null) {
            if (!actor.hasAuthority("PROPOSAL_READ") && !actor.hasAuthority("PROPOSAL_READ_OWN")) {
                throw new AccessDeniedException("Project filtering needs proposal read permission");
            }
            UUID projectDistrict = repo.districtIdOfProject(projectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
            requireWithinScope(districtScope, projectDistrict, "Project");
            if (!actor.hasAuthority("PROPOSAL_READ") && !repo.projectOwnedBy(projectId, actor.userId())) {
                throw new ResourceNotFoundException("Project not found");
            }
        }
        if (talukaId != null) {
            UUID talukaDistrict = repo.districtIdOfTaluka(talukaId)
                    .orElseThrow(() -> new ResourceNotFoundException("Taluka not found"));
            requireWithinScope(districtScope, talukaDistrict, "Taluka");
            if (projectId != null && !repo.projectHasTaluka(projectId, talukaId)) {
                throw new ResourceNotFoundException("Taluka not found for project");
            }
        }
        return new DashboardFilter(districtScope, projectId, talukaId, fromDate, toDate,
                enumFilter(proposalStatus, ProposalStatus.class, "proposalStatus"),
                enumFilter(projectStatus, ProjectStatus.class, "projectStatus"),
                enumFilter(acquisitionStatus, CaseStatus.class, "acquisitionStatus"));
    }

    private static <E extends Enum<E>> String enumFilter(String value, Class<E> type, String label) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, value).name();
        } catch (IllegalArgumentException ex) {
            throw new InvalidRequestException("Invalid " + label + ": " + value);
        }
    }

    private static void requireWithinScope(DistrictScope scope, UUID districtId, String label) {
        if (!scope.unrestricted() && !scope.districtIds().contains(districtId)) {
            throw new ResourceNotFoundException(label + " not found");
        }
    }
}