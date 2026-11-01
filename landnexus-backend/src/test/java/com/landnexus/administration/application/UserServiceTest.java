package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.api.dto.UserCreateRequest;
import com.landnexus.administration.api.dto.UserResponse;
import com.landnexus.administration.api.dto.UserRolesRequest;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.exception.DuplicateResourceException;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");
    private static final String STRONG = "Str0ng-Passw0rd!";

    @Mock private UserAccountRepository users;
    @Mock private RoleRepository roles;
    @Mock private RefreshTokenRepository refreshTokens;
    @Mock private PasswordEncoder passwordEncoder;

    private UserService service;

    private final CurrentActor centralAdmin = new CurrentActor(UUID.randomUUID(), "central", Set.of("CENTRAL_ADMIN"));
    private final CurrentActor superAdmin = new CurrentActor(UUID.randomUUID(), "root", Set.of("SUPER_ADMIN"));

    @BeforeEach
    void setUp() {
        service = new UserService(users, roles, refreshTokens, passwordEncoder, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private UserCreateRequest request(String password, String... roleCodes) {
        return new UserCreateRequest("  Alice ", "Alice@Example.com", "Alice   Example", password, Set.of(roleCodes));
    }

    private UserAccount existingUser(UUID id, String... roleCodes) {
        UserAccount user = new UserAccount();
        user.setUsername("bob");
        user.setEmail("bob@example.test");
        user.setFullName("Bob");
        user.setPasswordHash("hash");
        ReflectionTestUtils.setField(user, "id", id);
        for (String code : roleCodes) {
            user.getRoles().add(new Role(code, code, code));
        }
        return user;
    }

    @Test
    void create_weakPassword_isRejected_andNothingIsSaved() {
        assertThatThrownBy(() -> service.create(request("short1", "AUDITOR"), centralAdmin))
                .isInstanceOf(InvalidRequestException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void create_unknownRole_isRejected() {
        when(roles.findByCode("WIZARD")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request(STRONG, "wizard"), centralAdmin))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("WIZARD");
    }

    @Test
    void create_superAdminRole_byNonSuperAdmin_isForbidden() {
        when(roles.findByCode("SUPER_ADMIN")).thenReturn(Optional.of(new Role("SUPER_ADMIN", "Super", "all")));

        assertThatThrownBy(() -> service.create(request(STRONG, "SUPER_ADMIN"), centralAdmin))
                .isInstanceOf(AccessDeniedException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void create_superAdminRole_bySuperAdmin_isAllowed() {
        when(roles.findByCode("SUPER_ADMIN")).thenReturn(Optional.of(new Role("SUPER_ADMIN", "Super", "all")));
        when(users.existsByUsername("alice")).thenReturn(false);
        when(users.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode(STRONG)).thenReturn("hashed");
        when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = service.create(request(STRONG, "SUPER_ADMIN"), superAdmin);

        assertThat(response.roles()).containsExactly("SUPER_ADMIN");
    }

    @Test
    void create_duplicateUsername_isConflict() {
        when(roles.findByCode("AUDITOR")).thenReturn(Optional.of(new Role("AUDITOR", "Auditor", "ro")));
        when(users.existsByUsername("alice")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request(STRONG, "AUDITOR"), centralAdmin))
                .isInstanceOf(DuplicateResourceException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void create_duplicateEmail_isConflict() {
        when(roles.findByCode("AUDITOR")).thenReturn(Optional.of(new Role("AUDITOR", "Auditor", "ro")));
        when(users.existsByUsername("alice")).thenReturn(false);
        when(users.existsByEmail("alice@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request(STRONG, "AUDITOR"), centralAdmin))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void create_success_hashesPassword_andNormalizesFields() {
        when(roles.findByCode("AUDITOR")).thenReturn(Optional.of(new Role("AUDITOR", "Auditor", "ro")));
        when(users.existsByUsername("alice")).thenReturn(false);
        when(users.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode(STRONG)).thenReturn("hashed");
        when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = service.create(request(STRONG, "auditor"), centralAdmin);

        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("hashed");
        assertThat(saved.getValue().getUsername()).isEqualTo("alice");
        assertThat(saved.getValue().getEmail()).isEqualTo("alice@example.com");
        assertThat(saved.getValue().getFullName()).isEqualTo("Alice Example");
        assertThat(saved.getValue().getCreatedBy()).isEqualTo("central");
        assertThat(response.enabled()).isTrue();
        assertThat(response.roles()).containsExactly("AUDITOR");
    }

    @Test
    void setRoles_onSuperAdminAccount_byCentralAdmin_isForbidden() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.of(existingUser(id, "SUPER_ADMIN")));

        assertThatThrownBy(() -> service.setRoles(id, new UserRolesRequest(Set.of("AUDITOR")), centralAdmin))
                .isInstanceOf(AccessDeniedException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void setRoles_replacesTheRoleSet() {
        UUID id = UUID.randomUUID();
        UserAccount user = existingUser(id, "AUDITOR");
        when(users.findById(id)).thenReturn(Optional.of(user));
        when(roles.findByCode("CONSULTANT")).thenReturn(Optional.of(new Role("CONSULTANT", "Consultant", "c")));
        when(users.saveAndFlush(user)).thenReturn(user);

        UserResponse response = service.setRoles(id, new UserRolesRequest(Set.of("consultant")), centralAdmin);

        assertThat(response.roles()).containsExactly("CONSULTANT");
    }

    @Test
    void disable_ownAccount_isRejected() {
        UUID id = centralAdmin.userId();
        when(users.findById(id)).thenReturn(Optional.of(existingUser(id, "CENTRAL_ADMIN")));

        assertThatThrownBy(() -> service.setEnabled(id, false, centralAdmin))
                .isInstanceOf(InvalidRequestException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void disable_otherAccount_endsItsSessions() {
        UUID id = UUID.randomUUID();
        UserAccount user = existingUser(id, "AUDITOR");
        when(users.findById(id)).thenReturn(Optional.of(user));
        when(users.saveAndFlush(user)).thenReturn(user);

        UserResponse response = service.setEnabled(id, false, centralAdmin);

        assertThat(response.enabled()).isFalse();
        verify(refreshTokens).revokeAllForUser(id, NOW);
    }

    @Test
    void enable_doesNotTouchSessions() {
        UUID id = UUID.randomUUID();
        UserAccount user = existingUser(id, "AUDITOR");
        user.setEnabled(false);
        when(users.findById(id)).thenReturn(Optional.of(user));
        when(users.saveAndFlush(user)).thenReturn(user);

        UserResponse response = service.setEnabled(id, true, centralAdmin);

        assertThat(response.enabled()).isTrue();
        verify(refreshTokens, never()).revokeAllForUser(any(), any());
    }

    @Test
    void get_unknownUser_isNotFound() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(ResourceNotFoundException.class);
    }
}
