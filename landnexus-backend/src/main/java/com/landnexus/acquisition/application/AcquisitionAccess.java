package com.landnexus.acquisition.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/** Permission AND geographic scope. A case outside the caller's scope is reported as "not found". */
@Component
public class AcquisitionAccess {

    public static final String READ = "ACQUISITION_READ";

    private final GeoScopeService geoScope;

    public AcquisitionAccess(GeoScopeService geoScope) {
        this.geoScope = geoScope;
    }

    public boolean canView(CurrentActor actor, UUID districtId) {
        return actor.hasAuthority(READ) && geoScope.canAccessDistrict(actor, districtId);
    }

    public <T> Specification<T> visibleTo(CurrentActor actor) {
        if (!actor.hasAuthority(READ)) {
            return (root, query, cb) -> cb.disjunction();
        }
        Optional<Set<UUID>> districts = geoScope.accessibleDistrictIds(actor);
        if (districts.isEmpty()) {
            return (root, query, cb) -> cb.conjunction();
        }
        Set<UUID> allowed = districts.get();
        if (allowed.isEmpty()) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> root.get("districtId").in(allowed);
    }
}