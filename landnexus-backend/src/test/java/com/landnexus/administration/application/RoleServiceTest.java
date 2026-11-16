package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.api.dto.RolePermissionsRequest;
import com.landnexus.administration.api.dto.RoleResponse;
import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.PermissionRepository;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.security.CurrentActor;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock private RoleRepository roles;
    @Mock private PermissionRepository permissions;
    @Mock private UserAccountRepository users;
    @Mock private RefreshTokenRepository refreshTokens;
    @Mock private AuditService audit;

    private final UUID actorId = UUID.randomUUID();
    private final CurrentActor superAdmin = new CurrentActor(
            actorId, "root", Set.of("SUPER_ADMIN"), Set.of("ROLE_MANAGE"));
    private RoleService service;

    @BeforeEach
    void setUp() {
        service = new RoleService(roles, permissions, users, refreshTokens, audit,
                Clock.fixed(Instant.parse("2026-11-16T00:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void setPermissions_replacesSetAndAuditsChange() {
        UUID auditorId = UUID.randomUUID();
        UUID affectedUserId = UUID.randomUUID();
        Role auditor = new Role("AUDITOR", "Auditor", "Read-only access");
        ReflectionTestUtils.setField(auditor, "id", auditorId);
        Permission userRead = new Permission("USER_READ", "Read users");
        Permission auditRead = new Permission("AUDIT_READ", "Read audit events");
        Permission roleManage = new Permission("ROLE_MANAGE", "Manage role permissions");
        auditor.getPermissions().add(userRead);

        Role root = new Role("SUPER_ADMIN", "Super Administrator", "Full access");
        ReflectionTestUtils.setField(root, "id", UUID.randomUUID());
        root.getPermissions().add(roleManage);
        UserAccount actorAccount = new UserAccount();
        actorAccount.getRoles().add(root);
        UserAccount affectedUser = new UserAccount();
        ReflectionTestUtils.setField(affectedUser, "id", affectedUserId);

        when(roles.findById(auditorId)).thenReturn(Optional.of(auditor));
        when(permissions.findByCodeIn(Set.of("AUDIT_READ", "USER_READ"))).thenReturn(List.of(userRead, auditRead));
        when(users.findById(actorId)).thenReturn(Optional.of(actorAccount));
        when(users.findAllByRoleCode("AUDITOR")).thenReturn(List.of(affectedUser));
        when(roles.saveAndFlush(auditor)).thenReturn(auditor);

        RoleResponse saved = service.setPermissions(
                auditorId,
                new RolePermissionsRequest(Set.of("AUDIT_READ", "USER_READ")),
                superAdmin);

        assertThat(saved.permissions()).containsExactlyInAnyOrder("AUDIT_READ", "USER_READ");
        assertThat(affectedUser.getAuthorizationVersion()).isEqualTo(1);
        verify(refreshTokens).revokeAllForUser(affectedUserId, Instant.parse("2026-11-16T00:00:00Z"));
        verify(users).saveAll(List.of(affectedUser));
        verify(audit).record(eq("UPDATE_PERMISSIONS"), eq("Role"), eq(auditorId), any());
    }

    @Test
    void setPermissions_cannotRemoveManagementFromSuperAdmin() {
        UUID rootId = UUID.randomUUID();
        Role root = new Role("SUPER_ADMIN", "Super Administrator", "Full access");
        ReflectionTestUtils.setField(root, "id", rootId);
        when(roles.findById(rootId)).thenReturn(Optional.of(root));

        assertThatThrownBy(() -> service.setPermissions(rootId, new RolePermissionsRequest(Set.of()), superAdmin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("must keep ROLE_MANAGE");
    }

    @Test
    void setPermissions_nonSuperAdminCannotEditSuperAdminRole() {
        UUID rootId = UUID.randomUUID();
        Role root = new Role("SUPER_ADMIN", "Super Administrator", "Full access");
        when(roles.findById(rootId)).thenReturn(Optional.of(root));
        CurrentActor districtAdmin = new CurrentActor(UUID.randomUUID(), "district", Set.of("DISTRICT_ADMIN"));

        assertThatThrownBy(() -> service.setPermissions(rootId, new RolePermissionsRequest(Set.of()), districtAdmin))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void setPermissions_rejectsUnknownPermissionCode() {
        UUID auditorId = UUID.randomUUID();
        Role auditor = new Role("AUDITOR", "Auditor", "Read-only access");
        when(roles.findById(auditorId)).thenReturn(Optional.of(auditor));
        when(permissions.findByCodeIn(Set.of("UNKNOWN"))).thenReturn(List.of());

        assertThatThrownBy(() -> service.setPermissions(
                auditorId, new RolePermissionsRequest(Set.of("UNKNOWN")), superAdmin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("Unknown permission");
    }
}
