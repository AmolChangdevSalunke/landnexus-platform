package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.api.dto.CurrentUserResponse;
import com.landnexus.administration.api.dto.LoginRequest;
import com.landnexus.administration.api.dto.TokenResponse;
import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.RefreshToken;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.exception.AuthenticationFailedException;
import com.landnexus.shared.security.JwtProperties;
import com.landnexus.shared.security.JwtService;
import com.landnexus.shared.security.TokenHasher;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");
    private static final String RAW_REFRESH = "raw-refresh-token";

    @Mock private UserAccountRepository users;
    @Mock private RefreshTokenRepository refreshTokens;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;

    private final JwtProperties properties = new JwtProperties("0123456789abcdef0123456789abcdef", "landnexus", 15, 7);
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, refreshTokens, passwordEncoder, jwtService, properties,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private UserAccount user(UUID id) {
        UserAccount user = new UserAccount();
        user.setUsername("alice");
        user.setEmail("alice@example.test");
        user.setFullName("Alice Example");
        user.setPasswordHash("hash");
        user.setEnabled(true);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    @Test
    void login_unknownUser_failsWithGenericMessage() {
        when(users.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("Ghost", "whatever-123")))
                .isInstanceOf(AuthenticationFailedException.class)
                .hasMessage("Invalid username or password");
    }

    @Test
    void login_wrongPassword_countsTheFailure() {
        UserAccount user = user(UUID.randomUUID());
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad-password-1", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "bad-password-1")))
                .isInstanceOf(AuthenticationFailedException.class)
                .hasMessage("Invalid username or password");

        assertThat(user.getFailedLoginAttempts()).isEqualTo(1);
        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void login_fifthWrongPassword_locksTheAccountFor15Minutes() {
        UserAccount user = user(UUID.randomUUID());
        user.setFailedLoginAttempts(4);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad-password-1", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "bad-password-1")))
                .isInstanceOf(AuthenticationFailedException.class);

        assertThat(user.getLockedUntil()).isEqualTo(NOW.plus(AuthService.LOCK_DURATION));
        assertThat(user.getFailedLoginAttempts()).isZero();
    }

    @Test
    void login_lockedAccount_failsEvenWithTheCorrectPassword() {
        UserAccount user = user(UUID.randomUUID());
        user.setLockedUntil(NOW.plusSeconds(600));
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "correct-password-1")))
                .isInstanceOf(AuthenticationFailedException.class);

        verify(passwordEncoder, never()).matches("correct-password-1", "hash");
        verify(jwtService, never()).createAccessToken(any(), any(), any(), any());
    }

    @Test
    void login_disabledAccount_fails() {
        UserAccount user = user(UUID.randomUUID());
        user.setEnabled(false);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "correct-password-1")))
                .isInstanceOf(AuthenticationFailedException.class);
    }

    @Test
    void login_success_resetsCountersAndIssuesTokens() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        user.setFailedLoginAttempts(3);
        user.setLockedUntil(NOW.minusSeconds(60));
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password-1", "hash")).thenReturn(true);
        when(jwtService.createAccessToken(eq(id), eq("alice"), any(), eq(NOW))).thenReturn("access-jwt");

        TokenResponse response = service.login(new LoginRequest(" Alice ", "correct-password-1"));

        assertThat(response.accessToken()).isEqualTo("access-jwt");
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresInSeconds()).isEqualTo(900);
        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(user.getLockedUntil()).isNull();
        assertThat(user.getLastLoginAt()).isEqualTo(NOW);
        verify(refreshTokens).save(any(RefreshToken.class));
    }

    @Test
    void refresh_validToken_rotatesIt() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        RefreshToken stored = new RefreshToken(user, TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));
        when(jwtService.createAccessToken(eq(id), eq("alice"), any(), eq(NOW))).thenReturn("new-access");

        TokenResponse response = service.refresh(RAW_REFRESH);

        assertThat(response.accessToken()).isEqualTo("new-access");
        assertThat(response.refreshToken()).isNotEqualTo(RAW_REFRESH);
        assertThat(stored.getRevokedAt()).isEqualTo(NOW);
        verify(refreshTokens).save(any(RefreshToken.class));
    }

    @Test
    void refresh_alreadyUsedToken_revokesEverySessionOfThatUser() {
        UUID id = UUID.randomUUID();
        RefreshToken stored = new RefreshToken(user(id), TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        stored.setRevokedAt(NOW.minusSeconds(5));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.refresh(RAW_REFRESH)).isInstanceOf(AuthenticationFailedException.class);

        verify(refreshTokens).revokeAllForUser(id, NOW);
        verify(jwtService, never()).createAccessToken(any(), any(), any(), any());
    }

    @Test
    void refresh_expiredToken_fails() {
        RefreshToken stored = new RefreshToken(user(UUID.randomUUID()), TokenHasher.sha256(RAW_REFRESH), NOW.minusSeconds(1));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.refresh(RAW_REFRESH)).isInstanceOf(AuthenticationFailedException.class);

        verify(refreshTokens, never()).revokeAllForUser(any(), any());
    }

    @Test
    void refresh_forDisabledUser_fails() {
        UserAccount user = user(UUID.randomUUID());
        user.setEnabled(false);
        RefreshToken stored = new RefreshToken(user, TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.refresh(RAW_REFRESH)).isInstanceOf(AuthenticationFailedException.class);
    }

    @Test
    void refresh_unknownToken_fails() {
        when(refreshTokens.findByTokenHash(TokenHasher.sha256("nope"))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refresh("nope")).isInstanceOf(AuthenticationFailedException.class);
    }

    @Test
    void logout_revokesTheToken_andIgnoresUnknownOnes() {
        RefreshToken stored = new RefreshToken(user(UUID.randomUUID()), TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256("unknown"))).thenReturn(Optional.empty());

        service.logout(RAW_REFRESH);
        assertThat(stored.getRevokedAt()).isEqualTo(NOW);

        assertThatCode(() -> service.logout("unknown")).doesNotThrowAnyException();
    }

    @Test
    void currentUser_returnsRolesAndPermissionsWithoutRolePrefix() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        Role role = new Role("AUDITOR", "Auditor", "Read-only");
        role.getPermissions().add(new Permission("MASTER_DATA_READ", "read"));
        user.getRoles().add(role);
        when(users.findById(id)).thenReturn(Optional.of(user));

        CurrentUserResponse response = service.currentUser(id);

        assertThat(response.username()).isEqualTo("alice");
        assertThat(response.roles()).containsExactly("AUDITOR");
        assertThat(response.permissions()).containsExactly("MASTER_DATA_READ");
    }

    @Test
    void currentUser_unknownId_failsAuthentication() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.currentUser(id)).isInstanceOf(AuthenticationFailedException.class);
    }
}
