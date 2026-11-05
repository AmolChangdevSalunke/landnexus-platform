package com.landnexus.landrecords.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Who may see district-bound land records: the permission AND the geographic scope. A record outside the
 * caller's scope is reported as "not found", never "forbidden", so its existence is not revealed.
 */
@Component
public class LandAccess {

    public static final String READ = "LAND_RECORD_READ";

    private final GeoScopeService geoScope;

    public LandAccess(GeoScopeService geoScope) {
        this.geoScope = geoScope;
    }

    public boolean canView(CurrentActor actor, UUID districtId) {
        return actor.hasAuthority(READ) && geoScope.canAccessDistrict(actor, districtId);
    }

    /** A list filter for any entity that has a districtId attribute. */
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