package com.landnexus.administration.application;

import com.landnexus.administration.api.dto.CurrentUserResponse;
import com.landnexus.administration.api.dto.LoginRequest;
import com.landnexus.administration.api.dto.TokenResponse;
import com.landnexus.administration.domain.RefreshToken;
import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.RefreshTokenRepository;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.exception.AuthenticationFailedException;
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
 * Failures are deliberately generic so an attacker cannot tell a wrong username from a wrong password.
 */
@Service
public class AuthService {

    static final int MAX_FAILED_ATTEMPTS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    static final String BAD_CREDENTIALS = "Invalid username or password";
    static final String BAD_REFRESH_TOKEN = "Invalid or expired refresh token";

    private final UserAccountRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties properties;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(UserAccountRepository users, RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       JwtProperties properties, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.properties = properties;
        this.clock = clock;
        // Used to spend the same time hashing when the user does not exist (blocks timing-based user discovery).
        this.dummyHash = passwordEncoder.encode("landnexus-timing-equaliser");
    }

    /**
     * noRollbackFor matters: the failed-attempt counter must be saved even though we throw.
     * Without it the exception would roll the counter back and lockout would never trigger.
     */
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public TokenResponse login(LoginRequest request) {
        Instant now = clock.instant();
        String username = TextNormalizer.username(request.username());
        UserAccount user = users.findByUsername(username).orElse(null);

        if (user == null || !PasswordPolicy.fitsBcrypt(request.password())) {
            passwordEncoder.matches(String.valueOf(request.password()), dummyHash);
            throw new AuthenticationFailedException(BAD_CREDENTIALS);
        }
        boolean locked = user.getLockedUntil() != null && user.getLockedUntil().isAfter(now);
        if (!user.isEnabled() || locked) {
            passwordEncoder.matches(request.password(), dummyHash);
            throw new AuthenticationFailedException(BAD_CREDENTIALS);
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(now.plus(LOCK_DURATION));
                user.setFailedLoginAttempts(0);
            } else {
                user.setFailedLoginAttempts(attempts);
            }
            throw new AuthenticationFailedException(BAD_CREDENTIALS);
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        return issueTokens(user, now);
    }

    /** Each refresh token works once. Presenting an already-used token means it may be stolen: end all sessions. */
    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public TokenResponse refresh(String rawToken) {
        Instant now = clock.instant();
        RefreshToken stored = refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken))
                .orElseThrow(() -> new AuthenticationFailedException(BAD_REFRESH_TOKEN));

        if (stored.getRevokedAt() != null) {
            refreshTokens.revokeAllForUser(stored.getUser().getId(), now);
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

    private TokenResponse issueTokens(UserAccount user, Instant now) {
        String accessToken = jwtService.createAccessToken(user.getId(), user.getUsername(), user.authorityCodes(), now);
        String rawRefreshToken = TokenGenerator.newToken();
        Instant expiresAt = now.plus(Duration.ofDays(properties.refreshTokenDays()));
        refreshTokens.save(new RefreshToken(user, TokenHasher.sha256(rawRefreshToken), expiresAt));
        return new TokenResponse(accessToken, rawRefreshToken, "Bearer", properties.accessTokenMinutes() * 60);
    }
}
