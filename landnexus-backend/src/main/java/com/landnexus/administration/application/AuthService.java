package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.CurrentUserResponse;
import com.landnexus.administration.api.dto.LoginRequest;
import com.landnexus.administration.api.dto.TokenResponse;
import com.landnexus.administration.domain.LoginHistory;
import com.landnexus.administration.domain.RefreshToken;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.LoginHistoryRepository;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.AuthenticationFailedException;
import com.landnexus.shared.security.ClientInfo;
import com.landnexus.shared.security.JwtProperties;
import com.landnexus.shared.security.JwtService;
import com.landnexus.shared.security.TokenGenerator;
import com.landnexus.shared.security.TokenHasher;
import com.landnexus.shared.validation.PasswordPolicy;
import com.landnexus.shared.validation.TextNormalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Login, refresh-token rotation, logout and "who am I".
 * Failures are deliberately generic for the caller; the real reason goes into login history for administrators.
 */
@Service
public class AuthService {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    static final String BAD_CREDENTIALS = "Invalid username or password";
    static final String BAD_REFRESH_TOKEN = "Invalid or expired refresh token";

    private final UserAccountRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final LoginHistoryRepository loginHistory;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService audit;
    private final JwtProperties properties;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(UserAccountRepository users, RefreshTokenRepository refreshTokens,
                       LoginHistoryRepository loginHistory, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AuditService audit, JwtProperties properties, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.loginHistory = loginHistory;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.audit = audit;
        this.properties = properties;
        this.clock = clock;
        // Spent when a login cannot be checked normally, so timing does not reveal which usernames exist.
        this.dummyHash = passwordEncoder.encode("landnexus-timing-equaliser");
    }

    /**
     * noRollbackFor matters: the failed-attempt counter and the history row must be saved even though we throw.
     * Without it the exception would roll them back and lockout would never trigger.
     */
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public TokenResponse login(LoginRequest request, ClientInfo client) {
        Instant now = clock.instant();
        String username = TextNormalizer.username(request.username());
        UserAccount user = users.findByUsername(username).orElse(null);

        if (user == null) {
            burnTime();
            throw failedLogin(null, username, "UNKNOWN_USER", client, now);
        }
        if (!PasswordPolicy.fitsBcrypt(request.password())) {
            burnTime();
            throw failedLogin(user.getId(), username, "BAD_PASSWORD", client, now);
        }
        if (!user.isEnabled()) {
            burnTime();
            throw failedLogin(user.getId(), username, "ACCOUNT_DISABLED", client, now);
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            burnTime();
            throw failedLogin(user.getId(), username, "ACCOUNT_LOCKED", client, now);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(now.plus(LOCK_DURATION));
                user.setFailedLoginAttempts(0);
                audit.recordAs(user.getId(), user.getUsername(), "ACCOUNT_LOCKED", "UserAccount", user.getId(),
                        "Locked for " + LOCK_DURATION.toMinutes() + " minutes after " + MAX_FAILED_ATTEMPTS
                                + " failed logins");
            } else {
                user.setFailedLoginAttempts(attempts);
            }
            throw failedLogin(user.getId(), username, "BAD_PASSWORD", client, now);
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        loginHistory.save(LoginHistory.success(user.getId(), username, client, now));
        return issueTokens(user, now);
    }

    /** Each refresh token works once. Presenting an already-used token means it may be stolen: end all sessions. */
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public TokenResponse refresh(String rawToken) {
        Instant now = clock.instant();
        RefreshToken stored = refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken))
                .orElseThrow(() -> new AuthenticationFailedException(BAD_REFRESH_TOKEN));

        if (stored.getRevokedAt() != null) {
            UserAccount owner = stored.getUser();
            refreshTokens.revokeAllForUser(owner.getId(), now);
            audit.recordAs(owner.getId(), owner.getUsername(), "TOKEN_REUSE_DETECTED", "UserAccount", owner.getId(),
                    "A used refresh token was presented again; all sessions were revoked");
            throw new AuthenticationFailedException(BAD_REFRESH_TOKEN);
        }
        if (!stored.getExpiresAt().isAfter(now)) {
            throw new AuthenticationFailedException(BAD_REFRESH_TOKEN);
        }
        UserAccount user = stored.getUser();
        if (!user.isEnabled()) {
            throw new AuthenticationFailedException(BAD_REFRESH_TOKEN);
        }
        stored.setRevokedAt(now);
        return issueTokens(user, now);
    }

    /** Idempotent: an unknown or already-revoked token is simply ignored. */
    @Transactional
    public void logout(String rawToken) {
        Instant now = clock.instant();
        refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken)).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(now);
            }
        });
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse currentUser(UUID userId) {
        UserAccount user = users.findById(userId)
                .orElseThrow(() -> new AuthenticationFailedException("Authentication is required"));
        return CurrentUserResponse.from(user);
    }

    private AuthenticationFailedException failedLogin(UUID userId, String username, String reason,
                                                      ClientInfo client, Instant now) {
        loginHistory.save(LoginHistory.failure(userId, username, reason, client, now));
        return new AuthenticationFailedException(BAD_CREDENTIALS);
    }

    private void burnTime() {
        passwordEncoder.matches("landnexus-timing-equaliser-input", dummyHash);
    }

    private TokenResponse issueTokens(UserAccount user, Instant now) {
        String accessToken = jwtService.createAccessToken(user.getId(), user.getUsername(), user.authorityCodes(), now);
        String rawRefreshToken = TokenGenerator.newToken();
        Instant expiresAt = now.plus(Duration.ofDays(properties.refreshTokenDays()));
        refreshTokens.save(new RefreshToken(user, TokenHasher.sha256(rawRefreshToken), expiresAt));
        return new TokenResponse(accessToken, rawRefreshToken, "Bearer", properties.accessTokenMinutes() * 60);
    }
}
