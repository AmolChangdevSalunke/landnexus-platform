package com.landnexus.gis.api;

import com.landnexus.gis.api.dto.ConflictDtos.ConflictReport;
import com.landnexus.gis.application.ConflictService;
import com.landnexus.shared.security.CurrentActor;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/gis/projects/{projectId}")
public class GisConflictController {

    private final ConflictService service;

    public GisConflictController(ConflictService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/conflicts")
    public ConflictReport conflicts(@PathVariable UUID projectId, Authentication a) {
        return service.report(projectId, CurrentActor.from(a));
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/map")
    public ResponseEntity<String> map(@PathVariable UUID projectId, Authentication a) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(service.map(projectId, CurrentActor.from(a)));
    }
}