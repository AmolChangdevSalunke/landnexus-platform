package com.landnexus.administration.application;

import com.landnexus.administration.domain.UserAccount;
import com.landnexus.administration.infrastructure.UserAccountRepository;
import com.landnexus.shared.audit.AuditService;
import com.landnexus.shared.exception.InvalidRequestException;
import com.landnexus.shared.exception.ResourceNotFoundException;
import com.landnexus.shared.security.CurrentActor;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Changing and resetting passwords. A reset code is random (192 bits), shown ONCE to the administrator who issued it,
 * stored only as a SHA-256 hash, valid for 60 minutes and usable once. Every successful change or reset ends all
 * sessions of that user (their refresh tokens are deleted). Secrets never go into the audit text.
 */
@Service
public class PasswordService {

    static final int MIN_LENGTH = 12;
    static final int MAX_LENGTH = 128;
    static final Duration CODE_VALIDITY = Duration.ofMinutes(60);

    public record IssuedCode(String username, String code, Instant expiresAt) {
    }

    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public PasswordService(UserAccountRepository users, PasswordEncoder encoder, JdbcTemplate jdbc, AuditService audit, Clock clock) {
        this.users = users;
        this.encoder = encoder;
        this.jdbc = jdbc;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public void changePassword(CurrentActor actor, String current, String next) {
        UserAccount user = users.findById(actor.userId()).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!encoder.matches(current, user.getPasswordHash())) {
            throw new InvalidRequestException("The current password is not correct");
        }
        if (encoder.matches(next, user.getPasswordHash())) {
            throw new InvalidRequestException("The new password must be different from the current one");
        }
        requireStrong(next, user.getUsername());
        setPassword(user, next);
        audit.record("CHANGE_PASSWORD", "User", user.getId(), "password changed; all sessions of the user ended");
    }

    /** The returned code is the only copy: it cannot be read back later. A newer code replaces every older unused one. */
    @Transactional
    public IssuedCode issue(UUID targetUserId, CurrentActor actor) {
        UserAccount user = users.findById(targetUserId).orElseThrow(() -> new ResourceNotFoundException("User not found: " + targetUserId));
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = clock.instant().plus(CODE_VALIDITY);
        jdbc.update("UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL", user.getId());
        jdbc.update("INSERT INTO password_reset_tokens (user_id, token_hash, issued_by_user_id, expires_at) VALUES (?, ?, ?, ?)",
                user.getId(), sha256(code), actor.userId(), Timestamp.from(expires));
        audit.record("ISSUE_PASSWORD_RESET", "User", user.getId(), "one-time reset code issued, valid 60 minutes");
        return new IssuedCode(user.getUsername(), code, expires);
    }

    /** No login needed. A weak new password is refused WITHOUT using up the code. */
    @Transactional
    public void reset(String code, String next) {
        List<UUID[]> rows = jdbc.query("SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
                (rs, i) -> new UUID[] {rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class)},
                sha256(code.trim()), Timestamp.from(clock.instant()));
        if (rows.isEmpty()) {
            throw invalidCode();
        }
        UUID tokenId = rows.get(0)[0];
        UserAccount user = users.findById(rows.get(0)[1]).orElseThrow(PasswordService::invalidCode);
        requireStrong(next, user.getUsername());
        if (jdbc.update("UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", Timestamp.from(clock.instant()), tokenId) != 1) {
            throw invalidCode();
        }
        setPassword(user, next);
        audit.record("RESET_PASSWORD", "User", user.getId(), "password reset with a one-time code; all sessions of the user ended");
    }

    private void setPassword(UserAccount user, String next) {
        user.setPasswordHash(encoder.encode(next));
        users.saveAndFlush(user);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", user.getId());
    }

    private static InvalidRequestException invalidCode() {
        return new InvalidRequestException("The reset code is invalid or has expired");
    }

    static void requireStrong(String password, String username) {
        List<String> missing = new ArrayList<>();
        if (password.length() < MIN_LENGTH) {
            missing.add("at least " + MIN_LENGTH + " characters");
        }
        if (password.length() > MAX_LENGTH) {
            missing.add("at most " + MAX_LENGTH + " characters");
        }
        if (!password.matches("(?s).*\\p{Lu}.*")) {
            missing.add("an uppercase letter");
        }
        if (!password.matches("(?s).*\\p{Ll}.*")) {
            missing.add("a lowercase letter");
        }
        if (!password.matches("(?s).*\\d.*")) {
            missing.add("a digit");
        }
        if (username != null && username.length() >= 3 && password.toLowerCase(Locale.ROOT).contains(username.toLowerCase(Locale.ROOT))) {
            missing.add("no part of the user name");
        }
        if (!missing.isEmpty()) {
            throw new InvalidRequestException("The new password needs: " + String.join(", ", missing));
        }
    }

    static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}