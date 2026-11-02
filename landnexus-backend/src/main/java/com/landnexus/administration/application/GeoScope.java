package com.landnexus.administration.application;

import com.landnexus.administration.domain.District;
import java.util.Set;
import java.util.UUID;

/**
 * What a user may see geographically. Nationwide roles see everything; everyone else sees only the
 * States, Divisions and Districts that were explicitly assigned (no assignment means no access).
 */
public record GeoScope(boolean nationwide, Set<UUID> stateIds, Set<UUID> divisionIds, Set<UUID> districtIds) {

    public static GeoScope everything() {
        return new GeoScope(true, Set.of(), Set.of(), Set.of());
    }

    public boolean allows(District district) {
        if (nationwide) {
            return true;
        }
        if (districtIds.contains(district.getId())) {
            return true;
        }
        if (district.getState() != null && stateIds.contains(district.getState().getId())) {
            return true;
        }
        return district.getDivision() != null && divisionIds.contains(district.getDivision().getId());
    }
}
