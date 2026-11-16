package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.PermissionResponse;
import com.landnexus.administration.api.dto.RolePermissionsRequest;
import com.landnexus.administration.api.dto.RoleResponse;
import com.landnexus.administration.application.RoleService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/administration")
public class RoleController {

    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping("/roles")
    public List<RoleResponse> list() {
        return service.list();
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping("/permissions")
    public List<PermissionResponse> listPermissions() {
        return service.listPermissions();
    }

    @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    @PutMapping("/roles/{id}/permissions")
    public RoleResponse setPermissions(@PathVariable UUID id,
                                       @Valid @RequestBody RolePermissionsRequest request,
                                       Authentication authentication) {
        return service.setPermissions(id, request, CurrentActor.from(authentication));
    }
}
