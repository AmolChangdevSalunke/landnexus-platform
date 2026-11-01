package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.DistrictRequest;
import com.landnexus.administration.api.dto.DistrictResponse;
import com.landnexus.administration.application.DistrictService;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.shared.pagination.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Thin HTTP layer: all business rules live in DistrictService. */
@RestController
@RequestMapping("/api/v1/administration/districts")
public class DistrictController {

    private final DistrictService service;

    public DistrictController(DistrictService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_READ')")
    @GetMapping
    public PageResponse<DistrictResponse> list(
            @RequestParam(required = false) UUID stateId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(stateId, page, size);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_READ')")
    @GetMapping("/{id}")
    public DistrictResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DistrictResponse create(@Valid @RequestBody DistrictRequest request) {
        return service.create(request);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PutMapping("/{id}")
    public DistrictResponse update(@PathVariable UUID id, @Valid @RequestBody DistrictRequest request) {
        return service.update(id, request);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping("/{id}/activate")
    public DistrictResponse activate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.ACTIVE);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping("/{id}/deactivate")
    public DistrictResponse deactivate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.INACTIVE);
    }
}
