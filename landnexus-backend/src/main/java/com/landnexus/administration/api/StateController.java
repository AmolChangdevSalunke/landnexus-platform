package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.StateRequest;
import com.landnexus.administration.api.dto.StateResponse;
import com.landnexus.administration.application.StateService;
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

/** Thin HTTP layer: all business rules live in StateService. */
@RestController
@RequestMapping("/api/v1/administration/states")
public class StateController {

    private final StateService service;

    public StateController(StateService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_READ')")
    @GetMapping
    public PageResponse<StateResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_READ')")
    @GetMapping("/{id}")
    public StateResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StateResponse create(@Valid @RequestBody StateRequest request) {
        return service.create(request);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PutMapping("/{id}")
    public StateResponse update(@PathVariable UUID id, @Valid @RequestBody StateRequest request) {
        return service.update(id, request);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping("/{id}/activate")
    public StateResponse activate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.ACTIVE);
    }

    @PreAuthorize("hasAuthority('MASTER_DATA_WRITE')")
    @PostMapping("/{id}/deactivate")
    public StateResponse deactivate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.INACTIVE);
    }
}
