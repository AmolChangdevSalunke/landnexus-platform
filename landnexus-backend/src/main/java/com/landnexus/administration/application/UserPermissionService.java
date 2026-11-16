package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.UserPermissionDtos.OverrideRequest;
import com.landnexus.administration.api.dto.UserPermissionDtos.PermissionEntry;
import com.landnexus.administration.api.dto.UserPermissionDtos.UpdateRequest;
import com.landnexus.administration.api.dto.UserPermissionDtos.UserPermissions;
import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.domain.UserPermissionOverride;
import com.landnexus.administration.infrastructure.PermissionRepository;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.administration.infrastructure.UserPermissionOverrideRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserPermissionService {

    private final UserAccountRepository users;
    private final PermissionRepository permissions;
    private final UserPermissionOverrideRepository overrides;
    private final RefreshTokenRepository refreshTokens;
    private final AuditService audit;
    private final Clock clock;

    public UserPermissionService(UserAccountRepository users, PermissionRepository permissions,
                                UserPermissionOverrideRepository overrides, RefreshTokenRepository refreshTokens,
                                AuditService audit, Clock clock) {
        this.users = users;
        this.permissions = permissions;
        this.overrides = overrides;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
        this.clock = clock;
    }

    public UserPermissions get(UUID userId) {
        UserAccount user = find(userId);
        Map<String, Boolean> userOverrides = overrides.findByUser_Id(userId).stream()
                .collect(java.util.stream.Collectors.toMap(o -> o.getPermission().getCode(), UserPermissionOverride::isGranted));
        Set<String> roleGrants = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(java.util.stream.Collectors.toSet());
        List<PermissionEntry> entries = permissions.findAll().stream()
                .sorted(java.util.Comparator.comparing(Permission::getCode))
                .map(permission -> {
                    Boolean explicit = userOverrides.get(permission.getCode());
                    boolean roleGranted = roleGrants.contains(permission.getCode());
                    return new PermissionEntry(permission.getCode(), permission.getDescription(), roleGranted,
                            explicit, explicit == null ? roleGranted : explicit);
                }).toList();
        return new UserPermissions(userId, entries);
    }

    @Transactional
    public UserPermissions replace(UUID userId, UpdateRequest request, CurrentActor actor) {
        if (!actor.hasRole("SUPER_ADMIN")) {
            throw new AccessDeniedException("Only a SUPER_ADMIN can manage per-user permission overrides");
        }
        UserAccount user = find(userId);
        if (user.hasRole("SUPER_ADMIN")) {
            throw new InvalidRequestException("Per-user overrides cannot change a SUPER_ADMIN permission set");
        }
        Map<String, Boolean> requested = new HashMap<>();
        for (OverrideRequest override : request.overrides()) {
            String code = override.code().trim().toUpperCase(java.util.Locale.ROOT);
            if (requested.putIfAbsent(code, override.granted()) != null) {
                throw new InvalidRequestException("Duplicate permission override: " + code);
            }
            Permission permission = permissions.findByCode(code)
                    .orElseThrow(() -> new InvalidRequestException("Unknown permission: " + code));
            if (override.granted() && !actor.hasAuthority(permission.getCode())) {
                throw new AccessDeniedException("You cannot grant a permission you do not hold: " + code);
            }
        }

        List<UserPermissionOverride> saved = requested.entrySet().stream()
                .map(entry -> new UserPermissionOverride(user,
                        permissions.findByCode(entry.getKey()).orElseThrow(), entry.getValue(), actor.username()))
                .toList();
        overrides.deleteByUser_Id(userId);
        overrides.saveAll(saved);
        overrides.flush();
        user.invalidateAuthorization();
        users.saveAndFlush(user);
        refreshTokens.revokeAllForUser(userId, clock.instant());
        audit.record("REPLACE_USER_PERMISSIONS", "UserAccount", userId,
                "username=" + user.getUsername() + ", overrides=" + requested);
        return get(userId);
    }

    private UserAccount find(UUID id) {
        return users.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
