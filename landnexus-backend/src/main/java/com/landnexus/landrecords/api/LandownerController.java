package com.landnexus.landrecords.api;

import com.landnexus.landrecords.api.dto.LandDtos.LandownerRequest;
import com.landnexus.landrecords.api.dto.LandDtos.LandownerResponse;
import com.landnexus.landrecords.api.dto.LandDtos.LandownerSummary;
import com.landnexus.landrecords.application.LandownerService;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Sensitive personal data: reading needs LANDOWNER_READ, writing needs LAND_RECORD_WRITE. Every view is audited. */
@RestController
@RequestMapping("/api/v1/land-records/landowners")
public class LandownerController {

    private final LandownerService service;

    public LandownerController(LandownerService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('LANDOWNER_READ')")
    @GetMapping
    public PageResponse<LandownerSummary> list(@RequestParam(required = false) UUID districtId,
                                               @RequestParam(required = false) String name,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size,
                                               Authentication authentication) {
        return service.list(districtId, name, page, size, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LANDOWNER_READ')")
    @GetMapping("/{id}")
    public LandownerResponse get(@PathVariable UUID id, Authentication authentication) {
        return service.get(id, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LandownerResponse create(@Valid @RequestBody LandownerRequest request, Authentication authentication) {
        return service.create(request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PutMapping("/{id}")
    public LandownerResponse update(@PathVariable UUID id, @Valid @RequestBody LandownerRequest request,
                                    Authentication authentication) {
        return service.update(id, request, CurrentActor.from(authentication));
    }
}