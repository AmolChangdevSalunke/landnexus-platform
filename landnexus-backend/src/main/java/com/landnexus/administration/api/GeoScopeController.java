package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.DistrictResponse;
import com.landnexus.administration.api.dto.ScopeEntryResponse;
import com.landnexus.administration.api.dto.UserScopesRequest;
import com.landnexus.administration.application.GeoScopeService;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/administration")
public class GeoScopeController {

    private final GeoScopeService service;

    public GeoScopeController(GeoScopeService service) {
        this.service = service;
    }

    /** The districts the caller may work with (use this to fill district drop-downs). */
    @PreAuthorize("hasAuthority('MASTER_DATA_READ')")
    @GetMapping("/my-districts")
    public PageResponse<DistrictResponse> myDistricts(Authentication authentication,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return service.accessibleDistricts(CurrentActor.from(authentication), page, size);
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping("/users/{id}/scopes")
    public List<ScopeEntryResponse> scopes(@PathVariable UUID id) {
        return service.listScopes(id);
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PutMapping("/users/{id}/scopes")
    public List<ScopeEntryResponse> replaceScopes(@PathVariable UUID id,
                                                  @Valid @RequestBody UserScopesRequest request,
                                                  Authentication authentication) {
        return service.replaceScopes(id, request, CurrentActor.from(authentication));
    }
}
