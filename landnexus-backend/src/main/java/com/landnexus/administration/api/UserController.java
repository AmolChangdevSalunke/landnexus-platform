package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.UserCreateRequest;
import com.landnexus.administration.api.dto.UserResponse;
import com.landnexus.administration.api.dto.UserRolesRequest;
import com.landnexus.administration.api.dto.UserProfileUpdateRequest;
import com.landnexus.administration.api.dto.UserPermissionDtos.UpdateRequest;
import com.landnexus.administration.api.dto.UserPermissionDtos.UserPermissions;
import com.landnexus.administration.application.UserPermissionService;
import com.landnexus.administration.application.UserService;
import com.landnexus.shared.pagination.PageResponse;
import com.landnexus.shared.security.CurrentActor;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/administration/users")
public class UserController {

    private final UserService service;
    private final UserPermissionService permissions;

    public UserController(UserService service, UserPermissionService permissions) {
        this.service = service;
        this.permissions = permissions;
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping
    public PageResponse<UserResponse> list(@RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping("/{id}/permissions")
    public UserPermissions permissions(@PathVariable UUID id) {
        return permissions.get(id);
    }

    @PreAuthorize("hasAuthority('USER_PERMISSION_MANAGE')")
    @PutMapping("/{id}/permissions")
    public UserPermissions updatePermissions(@PathVariable UUID id, @Valid @RequestBody UpdateRequest request,
                                             Authentication authentication) {
        return permissions.replace(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PutMapping("/{id}")
    public UserResponse updateProfile(@PathVariable UUID id,
                                      @Valid @RequestBody UserProfileUpdateRequest request,
                                      Authentication authentication) {
        return service.updateProfile(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody UserCreateRequest request, Authentication authentication) {
        return service.create(request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PutMapping("/{id}/roles")
    public UserResponse setRoles(@PathVariable UUID id, @Valid @RequestBody UserRolesRequest request,
                                 Authentication authentication) {
        return service.setRoles(id, request, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PostMapping("/{id}/enable")
    public UserResponse enable(@PathVariable UUID id, Authentication authentication) {
        return service.setEnabled(id, true, CurrentActor.from(authentication));
    }

    @PreAuthorize("hasAuthority('USER_WRITE')")
    @PostMapping("/{id}/disable")
    public UserResponse disable(@PathVariable UUID id, Authentication authentication) {
        return service.setEnabled(id, false, CurrentActor.from(authentication));
    }
}
