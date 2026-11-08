package com.landnexus.reporting.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.reporting.infrastructure.DashboardRepository;
import com.landnexus.reporting.infrastructure.DistrictScope;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

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
}