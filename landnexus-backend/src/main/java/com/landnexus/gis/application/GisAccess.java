package com.landnexus.gis.application;

import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.shared.security.CurrentActor;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Permission AND geographic scope. Anything outside the caller's scope is reported as "not found". */
@Component
public class GisAccess {

    public static final String READ = "GIS_READ";

    private final GeoScopeService geoScope;

    public GisAccess(GeoScopeService geoScope) {
        this.geoScope = geoScope;
    }

    public boolean canView(CurrentActor actor, UUID districtId) {
        return actor.hasAuthority(READ) && geoScope.canAccessDistrict(actor, districtId);
    }
}