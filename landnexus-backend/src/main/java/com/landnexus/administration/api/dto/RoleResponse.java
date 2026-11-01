package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.Role;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

public record RoleResponse(UUID id, String code, String name, String description, Set<String> permissions) {

    public static RoleResponse from(Role role) {
        Set<String> codes = new TreeSet<>();
        for (Permission permission : role.getPermissions()) {
            codes.add(permission.getCode());
        }
        return new RoleResponse(role.getId(), role.getCode(), role.getName(), role.getDescription(), codes);
    }
}
