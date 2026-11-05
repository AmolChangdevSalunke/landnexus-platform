package com.landnexus.projects.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.shared.security.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Who may see a proposal or project:
 * PROPOSAL_READ (officers and administrators) sees records in their geographic scope (nationwide roles see all);
 * PROPOSAL_READ_OWN (consultants) sees only records they own; anyone else sees nothing.
 */
@Component
public class ProposalAccess {

    public static final String READ = "PROPOSAL_READ";
    public static final String READ_OWN = "PROPOSAL_READ_OWN";

    private final GeoScopeService geoScope;

    public ProposalAccess(GeoScopeService geoScope) {
        this.geoScope = geoScope;
    }

    public boolean canView(CurrentActor actor, UUID districtId, UUID ownerUserId) {
        if (actor.hasAuthority(READ)) {
            return geoScope.canAccessDistrict(actor, districtId);
        }
        return actor.hasAuthority(READ_OWN) && actor.userId().equals(ownerUserId);
    }

    /** A filter for list queries; works for any entity with districtId and ownerUserId attributes. */
    public <T> Specification<T> visibleTo(CurrentActor actor) {
        if (actor.hasAuthority(READ)) {
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
        if (actor.hasAuthority(READ_OWN)) {
            UUID userId = actor.userId();
            return (root, query, cb) -> cb.equal(root.get("ownerUserId"), userId);
        }
        return (root, query, cb) -> cb.disjunction();
    }
}
