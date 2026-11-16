package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.PermissionResponse;
import com.landnexus.administration.api.dto.RolePermissionsRequest;
import com.landnexus.administration.api.dto.RoleResponse;
import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.PermissionRepository;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.time.Clock;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Role and permission administration (BUG-008).
 *
 * <p>Guards are deliberately server-side: a role's permission set can only be replaced by a caller with
 * ROLE_MANAGE, the SUPER_ADMIN role must keep ROLE_MANAGE, and the caller cannot remove ROLE_MANAGE from
 * their own effective permissions. Every change is audited in the same transaction.</p>
 *
 * <p>Permission changes increment authorization versions and revoke refresh tokens for every affected account.</p>
 */
@Service
@Transactional(readOnly = true)
public class RoleService {

    static final String SUPER_ADMIN = "SUPER_ADMIN";
    static final String ROLE_MANAGE = "ROLE_MANAGE";

    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final UserAccountRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final AuditService audit;
    private final Clock clock;

    public RoleService(RoleRepository roles, PermissionRepository permissions,
                       UserAccountRepository users, RefreshTokenRepository refreshTokens, AuditService audit, Clock clock) {
        this.roles = roles;
        this.permissions = permissions;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
        this.clock = clock;
    }

    public List<RoleResponse> list() {
        return roles.findAll().stream()
                .sorted(Comparator.comparing(Role::getCode))
                .map(RoleResponse::from)
                .toList();
    }

    public List<PermissionResponse> listPermissions() {
        return PermissionResponse.fromAll(permissions.findAll());
    }

    @Transactional
    public RoleResponse setPermissions(UUID id, RolePermissionsRequest request, CurrentActor actor) {
        Role role = roles.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + id));

        if (SUPER_ADMIN.equals(role.getCode()) && !actor.hasRole(SUPER_ADMIN)) {
            throw new AccessDeniedException("Only a SUPER_ADMIN can change the SUPER_ADMIN role");
        }

        Set<Permission> requested = resolvePermissions(request.permissions());
        Set<String> requestedCodes = permissionCodes(requested);

        if (SUPER_ADMIN.equals(role.getCode()) && !requestedCodes.contains(ROLE_MANAGE)) {
            throw new InvalidRequestException(
                    "The SUPER_ADMIN role must keep ROLE_MANAGE so access can always be recovered");
        }
        if (!retainsRoleManagement(actor.userId(), role.getId(), requestedCodes)) {
            throw new InvalidRequestException(
                    "This change would remove ROLE_MANAGE from your own account");
        }

        Set<String> before = permissionCodes(role.getPermissions());
        role.getPermissions().clear();
        role.getPermissions().addAll(requested);
        Role saved = roles.saveAndFlush(role);
        List<UserAccount> affectedUsers = users.findAllByRoleCode(saved.getCode());
        affectedUsers.forEach(user -> {
            user.invalidateAuthorization();
            refreshTokens.revokeAllForUser(user.getId(), clock.instant());
        });
        users.saveAll(affectedUsers);

        audit.record("UPDATE_PERMISSIONS", "Role", saved.getId(),
                "code=" + saved.getCode() + ", permissions: " + before + " -> " + requestedCodes
                        + ", affectedUsers=" + affectedUsers.size());
        return RoleResponse.from(saved);
    }

    private Set<Permission> resolvePermissions(Set<String> requested) {
        if (requested == null) {
            throw new InvalidRequestException("A permission set is required");
        }
        Set<String> codes = new TreeSet<>();
        for (String raw : requested) {
            if (raw == null || raw.isBlank()) {
                throw new InvalidRequestException("Permission codes must not be blank");
            }
            codes.add(raw.trim().toUpperCase(Locale.ROOT));
        }
        if (codes.isEmpty()) {
            return Set.of();
        }

        List<Permission> found = permissions.findByCodeIn(codes);
        Set<String> known = new HashSet<>();
        for (Permission permission : found) {
            known.add(permission.getCode());
        }
        Set<String> unknown = new TreeSet<>(codes);
        unknown.removeAll(known);
        if (!unknown.isEmpty()) {
            throw new InvalidRequestException("Unknown permission: " + String.join(", ", unknown));
        }
        return new HashSet<>(found);
    }

    /**
     * Recomputes the caller's effective permissions as they would be after this change. Uses the database,
     * not the token, so a stale token cannot be used to lock the account out of administration.
     */
    private boolean retainsRoleManagement(UUID actorId, UUID editedRoleId, Set<String> requestedCodes) {
        UserAccount actor = users.findById(actorId).orElse(null);
        if (actor == null) {
            return false;
        }
        Set<String> effective = new TreeSet<>();
        for (Role role : actor.getRoles()) {
            if (role.getId().equals(editedRoleId)) {
                effective.addAll(requestedCodes);
            } else {
                effective.addAll(permissionCodes(role.getPermissions()));
            }
        }
        return effective.contains(ROLE_MANAGE);
    }

    private static Set<String> permissionCodes(Collection<Permission> permissions) {
        Set<String> codes = new TreeSet<>();
        for (Permission permission : permissions) {
            codes.add(permission.getCode());
        }
        return codes;
    }
}
