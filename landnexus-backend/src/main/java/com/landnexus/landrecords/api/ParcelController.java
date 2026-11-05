package com.landnexus.landrecords.api;

import com.landnexus.landrecords.api.dto.LandDtos.ParcelRequest;
import com.landnexus.landrecords.api.dto.LandDtos.ParcelResponse;
import com.landnexus.landrecords.application.ParcelService;
import com.landnexus.landrecords.domain.LandTypes.ParcelStatus;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/land-records/parcels")
public class ParcelController {

    private final ParcelService service;

    public ParcelController(ParcelService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_READ')")
    @GetMapping
    public PageResponse<ParcelResponse> list(@RequestParam(required = false) UUID districtId,
                                             @RequestParam(required = false) UUID villageId,
                                             @RequestParam(required = false) String number,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size,
                                             Authentication authentication) {
        return service.list(districtId, villageId, number, page, size, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_READ')")
    @GetMapping("/{id}")
    public ParcelResponse get(@PathVariable UUID id, Authentication authentication) {
        return service.get(id, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ParcelResponse create(@Valid @RequestBody ParcelRequest request, Authentication authentication) {
        return service.create(request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PutMapping("/{id}")
    public ParcelResponse update(@PathVariable UUID id, @Valid @RequestBody ParcelRequest request,
                                 Authentication authentication) {
        return service.update(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/{id}/activate")
    public ParcelResponse activate(@PathVariable UUID id, Authentication authentication) {
        return service.setStatus(id, ParcelStatus.ACTIVE, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('LAND_RECORD_WRITE')")
    @PostMapping("/{id}/deactivate")
    public ParcelResponse deactivate(@PathVariable UUID id, Authentication authentication) {
        return service.setStatus(id, ParcelStatus.INACTIVE, CurrentActor.from(authentication));
    }
}