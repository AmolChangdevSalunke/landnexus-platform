package com.landnexus.administration.api;

import com.landnexus.administration.api.dto.RoleResponse;
import com.landnexus.administration.application.UserService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/administration/roles")
public class RoleController {

    private final UserService service;

    public RoleController(UserService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping
    public List<RoleResponse> list() {
        return service.listRoles();
    }
}
