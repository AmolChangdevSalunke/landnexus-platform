package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.VillageRequest;
import com.landnexus.administration.api.dto.VillageResponse;
import com.landnexus.administration.application.VillageService;
import com.landnexus.administration.domain.RecordStatus;
import com.landnexus.shared.pagination.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Thin HTTP layer: all business rules live in VillageService. */
@RestController
@RequestMapping("/api/v1/administration/villages")
public class VillageController {

    private final VillageService service;

    public VillageController(VillageService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<VillageResponse> list(
            @RequestParam(required = false) UUID talukaId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(talukaId, page, size);
    }

    @GetMapping("/{id}")
    public VillageResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VillageResponse create(@Valid @RequestBody VillageRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public VillageResponse update(@PathVariable UUID id, @Valid @RequestBody VillageRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/activate")
    public VillageResponse activate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.ACTIVE);
    }

    @PostMapping("/{id}/deactivate")
    public VillageResponse deactivate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.INACTIVE);
    }
}
