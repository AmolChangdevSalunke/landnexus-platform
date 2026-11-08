package com.landnexus.reporting.infrastructure;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Which districts a report may include. The SQL fragment is a constant (never user input); the ids are bind parameters.
 * An empty restricted scope matches nothing.
 */
public record DistrictScope(boolean unrestricted, Set<UUID> districtIds) {

    public static DistrictScope all() {
        return new DistrictScope(true, Set.of());
    }

    public boolean isEmpty() {
        return !unrestricted && districtIds.isEmpty();
    }

    public String sql(String column) {
        if (unrestricted) {
            return "";
        }
        return districtIds.isEmpty() ? " AND FALSE" : " AND " + column + " IN (:ids)";
    }

    public Map<String, Object> params() {
        return Map.of("ids", List.copyOf(districtIds));
    }
}