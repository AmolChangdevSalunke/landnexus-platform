package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RoleRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class BootstrapAdminServiceTest {

    @Mock private UserAccountRepository users;
    @Mock private RoleRepository roles;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuditService audit;

    private BootstrapAdminService service;

    @BeforeEach
    void setUp() {
        service = new BootstrapAdminService(users, roles, passwordEncoder, audit);
    }

    @Test
    void doesNothing_whenUsersAlreadyExist() {
        when(users.count()).thenReturn(1L);

        assertThat(service.bootstrapIfNeeded("admin", "Str0ng-Passw0rd!", null)).isFalse();
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void doesNothing_whenCredentialsAreNotConfigured() {
        when(users.count()).thenReturn(0L);

        assertThat(service.bootstrapIfNeeded("", "", null)).isFalse();
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void refusesAWeakPassword() {
        when(users.count()).thenReturn(0L);

        assertThatThrownBy(() -> service.bootstrapIfNeeded("admin", "weak", null))
                .isInstanceOf(InvalidRequestException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void createsTheFirstSuperAdmin() {
        when(users.count()).thenReturn(0L);
        when(roles.findByCode("SUPER_ADMIN")).thenReturn(Optional.of(new Role("SUPER_ADMIN", "Super", "all")));
        when(passwordEncoder.encode("Str0ng-Passw0rd!")).thenReturn("hashed");
        when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.bootstrapIfNeeded("  Admin ", "Str0ng-Passw0rd!", "")).isTrue();

        ArgumentCaptor<UserAccount> saved = ArgumentCaptor.forClass(UserAccount.class);
        verify(users).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getUsername()).isEqualTo("admin");
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("hashed");
        assertThat(saved.getValue().getEmail()).isEqualTo("admin@landnexus.local");
        assertThat(saved.getValue().roleCodes()).containsExactly("SUPER_ADMIN");
        verify(audit).recordAs(any(), eq("bootstrap"), eq("BOOTSTRAP_ADMIN_CREATED"), eq("UserAccount"), any(), anyString());
    }
}
