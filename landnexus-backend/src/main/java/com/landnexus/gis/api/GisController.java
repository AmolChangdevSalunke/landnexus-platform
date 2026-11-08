package com.landnexus.gis.api;

import com.landnexus.gis.api.dto.GisDtos.AlignmentResponse;
import com.landnexus.gis.api.dto.GisDtos.AlignmentVersion;
import com.landnexus.gis.api.dto.GisDtos.BoundaryResponse;
import com.landnexus.gis.api.dto.GisDtos.BoundaryVersion;
import com.landnexus.gis.application.GisService;
import com.landnexus.shared.security.CurrentActor;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Thin HTTP layer. A request body is one GeoJSON geometry object ({"type":"Polygon","coordinates":[...]}),
 * coordinates are [longitude, latitude]. Map responses are GeoJSON Feature or FeatureCollection documents.
 */
@RestController
@RequestMapping("/api/v1/gis")
public class GisController {

    private final GisService service;

    public GisController(GisService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('GIS_WRITE')")
    @PutMapping(path = "/parcels/{parcelId}/boundary", consumes = MediaType.APPLICATION_JSON_VALUE)
    public BoundaryResponse setBoundary(@PathVariable UUID parcelId, @RequestParam(required = false) String sourceNote,
                                        @RequestBody String geometry, Authentication a) {
        return service.setParcelBoundary(parcelId, geometry, sourceNote, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/parcels/{parcelId}/boundary")
    public ResponseEntity<String> boundary(@PathVariable UUID parcelId, Authentication a) {
        return json(service.parcelBoundaryFeature(parcelId, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/parcels/{parcelId}/boundary/history")
    public List<BoundaryVersion> boundaryHistory(@PathVariable UUID parcelId, Authentication a) {
        return service.parcelBoundaryHistory(parcelId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/villages/{villageId}/parcels")
    public ResponseEntity<String> villageParcels(@PathVariable UUID villageId, Authentication a) {
        return json(service.villageParcelsFeatureCollection(villageId, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_WRITE')")
    @PutMapping(path = "/projects/{projectId}/alignment", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AlignmentResponse setAlignment(@PathVariable UUID projectId, @RequestParam int corridorWidthM,
                                          @RequestParam(required = false) String sourceNote,
                                          @RequestBody String geometry, Authentication a) {
        return service.setAlignment(projectId, geometry, corridorWidthM, sourceNote, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/projects/{projectId}/alignment")
    public ResponseEntity<String> alignment(@PathVariable UUID projectId, Authentication a) {
        return json(service.alignmentFeature(projectId, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/projects/{projectId}/corridor")
    public ResponseEntity<String> corridor(@PathVariable UUID projectId, Authentication a) {
        return json(service.corridorFeature(projectId, CurrentActor.from(a)));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/projects/{projectId}/alignment/history")
    public List<AlignmentVersion> alignmentHistory(@PathVariable UUID projectId, Authentication a) {
        return service.alignmentHistory(projectId, CurrentActor.from(a));
    }

    private static ResponseEntity<String> json(String body) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
    }
}