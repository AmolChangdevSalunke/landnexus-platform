package com.landnexus.administration.api.dto;

import com.landnexus.administration.domain.Permission;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record PermissionResponse(UUID id, String code, String description) {

    public static PermissionResponse from(Permission permission) {
        return new PermissionResponse(permission.getId(), permission.getCode(), permission.getDescription());
    }

    public static List<PermissionResponse> fromAll(List<Permission> permissions) {
        return permissions.stream()
                .sorted(Comparator.comparing(Permission::getCode))
                .map(PermissionResponse::from)
                .toList();
    }
}
