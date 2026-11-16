package com.landnexus.administration.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.landnexus.administration.api.dto.CurrentUserResponse;
import com.landnexus.administration.api.dto.LoginRequest;
import com.landnexus.administration.api.dto.TokenResponse;
import com.landnexus.administration.domain.LoginHistory;
import com.landnexus.administration.domain.Permission;
import com.landnexus.administration.domain.RefreshToken;
import com.landnexus.administration.domain.Role;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.LoginHistoryRepository;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.AuthenticationFailedException;
import com.landnexus.shared.security.ClientInfo;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");
    private static final String RAW_REFRESH = "raw-refresh-token";
    private static final ClientInfo CLIENT = new ClientInfo("10.0.0.7", "JUnit");

    @Mock private UserAccountRepository users;
    @Mock private RefreshTokenRepository refreshTokens;
    @Mock private LoginHistoryRepository loginHistory;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuditService audit;

    private final JwtProperties properties = new JwtProperties("0123456789abcdef0123456789abcdef", "landnexus", 15, 7);
    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, refreshTokens, loginHistory, passwordEncoder, jwtService, audit,
                properties, Clock.fixed(NOW, ZoneOffset.UTC));
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

    private LoginHistory savedHistory() {
        ArgumentCaptor<LoginHistory> captor = ArgumentCaptor.forClass(LoginHistory.class);
        verify(loginHistory).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void login_unknownUser_failsWithGenericMessage_andIsRecorded() {
        when(users.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("Ghost", "whatever-123"), CLIENT))
                .isInstanceOf(AuthenticationFailedException.class)
                .hasMessage("Invalid username or password");

        LoginHistory history = savedHistory();
        assertThat(history.isSuccess()).isFalse();
        assertThat(history.getFailureReason()).isEqualTo("UNKNOWN_USER");
        assertThat(history.getUsernameAttempted()).isEqualTo("ghost");
        assertThat(history.getIpAddress()).isEqualTo("10.0.0.7");
        assertThat(history.getUserId()).isNull();
    }

    @Test
    void login_wrongPassword_countsTheFailure_andIsRecorded() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad-password-1", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "bad-password-1"), CLIENT))
                .isInstanceOf(AuthenticationFailedException.class)
                .hasMessage("Invalid username or password");

        assertThat(user.getFailedLoginAttempts()).isEqualTo(1);
        assertThat(user.getLockedUntil()).isNull();
        LoginHistory history = savedHistory();
        assertThat(history.getFailureReason()).isEqualTo("BAD_PASSWORD");
        assertThat(history.getUserId()).isEqualTo(id);
    }

    @Test
    void login_fifthWrongPassword_locksTheAccountFor15Minutes_andAudits() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        user.setFailedLoginAttempts(4);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad-password-1", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "bad-password-1"), CLIENT))
                .isInstanceOf(AuthenticationFailedException.class);

        assertThat(user.getLockedUntil()).isEqualTo(NOW.plus(AuthService.LOCK_DURATION));
        assertThat(user.getFailedLoginAttempts()).isZero();
        verify(audit).recordAs(eq(id), eq("alice"), eq("ACCOUNT_LOCKED"), eq("UserAccount"), eq(id), anyString());
    }

    @Test
    void login_lockedAccount_failsEvenWithTheCorrectPassword() {
        UserAccount user = user(UUID.randomUUID());
        user.setLockedUntil(NOW.plusSeconds(600));
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "correct-password-1"), CLIENT))
                .isInstanceOf(AuthenticationFailedException.class);

        verify(passwordEncoder, never()).matches("correct-password-1", "hash");
        verify(jwtService, never()).createAccessToken(any(), any(), any(), anyLong(), any());
        assertThat(savedHistory().getFailureReason()).isEqualTo("ACCOUNT_LOCKED");
    }

    @Test
    void login_disabledAccount_fails_andIsRecorded() {
        UserAccount user = user(UUID.randomUUID());
        user.setEnabled(false);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("alice", "correct-password-1"), CLIENT))
                .isInstanceOf(AuthenticationFailedException.class);

        assertThat(savedHistory().getFailureReason()).isEqualTo("ACCOUNT_DISABLED");
    }

    @Test
    void login_success_resetsCountersIssuesTokens_andIsRecorded() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        user.setFailedLoginAttempts(3);
        user.setLockedUntil(NOW.minusSeconds(60));
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password-1", "hash")).thenReturn(true);
        when(jwtService.createAccessToken(eq(id), eq("alice"), any(), eq(0L), eq(NOW))).thenReturn("access-jwt");

        TokenResponse response = service.login(new LoginRequest(" Alice ", "correct-password-1"), CLIENT);

        assertThat(response.accessToken()).isEqualTo("access-jwt");
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.expiresInSeconds()).isEqualTo(900);
        assertThat(user.getFailedLoginAttempts()).isZero();
        assertThat(user.getLockedUntil()).isNull();
        assertThat(user.getLastLoginAt()).isEqualTo(NOW);
        verify(refreshTokens).save(any(RefreshToken.class));
        LoginHistory history = savedHistory();
        assertThat(history.isSuccess()).isTrue();
        assertThat(history.getFailureReason()).isNull();
    }

    @Test
    void refresh_validToken_rotatesIt() {
        UUID id = UUID.randomUUID();
        UserAccount user = user(id);
        RefreshToken stored = new RefreshToken(user, TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));
        when(jwtService.createAccessToken(eq(id), eq("alice"), any(), eq(0L), eq(NOW))).thenReturn("new-access");

        TokenResponse response = service.refresh(RAW_REFRESH);

        assertThat(response.accessToken()).isEqualTo("new-access");
        assertThat(response.refreshToken()).isNotEqualTo(RAW_REFRESH);
        assertThat(stored.getRevokedAt()).isEqualTo(NOW);
        verify(refreshTokens).save(any(RefreshToken.class));
    }

    @Test
    void refresh_alreadyUsedToken_revokesEverySession_andAudits() {
        UUID id = UUID.randomUUID();
        RefreshToken stored = new RefreshToken(user(id), TokenHasher.sha256(RAW_REFRESH), NOW.plusSeconds(3600));
        stored.setRevokedAt(NOW.minusSeconds(5));
        when(refreshTokens.findByTokenHash(TokenHasher.sha256(RAW_REFRESH))).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.refresh(RAW_REFRESH)).isInstanceOf(AuthenticationFailedException.class);

        verify(refreshTokens).revokeAllForUser(id, NOW);
        verify(audit).recordAs(eq(id), eq("alice"), eq("TOKEN_REUSE_DETECTED"), eq("UserAccount"), eq(id), anyString());
        verify(jwtService, never()).createAccessToken(any(), any(), any(), anyLong(), any());
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
