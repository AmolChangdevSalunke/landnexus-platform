package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.DepartmentRequest;
import com.landnexus.administration.api.dto.DepartmentResponse;
import com.landnexus.administration.application.DepartmentService;
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

/** Thin HTTP layer: all business rules live in DepartmentService. */
@RestController
@RequestMapping("/api/v1/administration/departments")
public class DepartmentController {

    private final DepartmentService service;

    public DepartmentController(DepartmentService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<DepartmentResponse> list(
            @RequestParam(required = false) UUID ministryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(ministryId, page, size);
    }

    @GetMapping("/{id}")
    public DepartmentResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse create(@Valid @RequestBody DepartmentRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public DepartmentResponse update(@PathVariable UUID id, @Valid @RequestBody DepartmentRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/activate")
    public DepartmentResponse activate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.ACTIVE);
    }

    @PostMapping("/{id}/deactivate")
    public DepartmentResponse deactivate(@PathVariable UUID id) {
        return service.setStatus(id, RecordStatus.INACTIVE);
    }
}
